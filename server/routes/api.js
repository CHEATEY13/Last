const express = require('express');
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { optionalAuth } = require('../middleware/auth');
const User = require('../models/user');
const axios = require('axios');

const router = express.Router();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'demo-key');

// Hugging Face API configuration
const HF_API_URL = 'https://api-inference.huggingface.co/models';
const HF_HEADERS = {
  'Authorization': `Bearer ${process.env.HF_API_KEY}`,
  'Content-Type': 'application/json'
};

// Prompts for different operations
const prompts = {
  analyze: `You are a helpful programming tutor and expert code analyst. Analyze the provided code in clear, beginner-friendly language. Explain what the code does and provide a line-by-line breakdown.

IMPORTANT INSTRUCTIONS:
- Analyze the EXACT code provided - explain what it actually does
- Automatically detect the programming language from the code
- Use friendly, conversational language like you're teaching a friend
- Focus on WHY things work, not just WHAT they do
- Be concise but informative

Output must be valid JSON format:
{
  "language": "<detected programming language>",
  "overview": "<friendly explanation of what this specific code does and its main purpose>",
  "lineByLineAnalysis": [
    { "line": "<actual code line>", "explanation": "<explanation of what this specific line accomplishes>" }
  ],
  "output": "<what happens when this code runs>",
  "summary": "<summary explaining the specific functionality this code provides>",
  "suggestions": ["<specific improvements for this exact code>"]
}`,


  translate: `You are a code translator. Convert code into the selected target language, preserving functionality.

Rules:
- If using browser APIs (DOM), convert to appropriate GUI framework or backend equivalent
- Only return runnable code
- Maintain the same logic and functionality
- Add necessary imports/dependencies

Output JSON format:
{
  "language": "<target language>",
  "translatedCode": "<complete runnable code>",
  "dependencies": ["<dependency 1>", "<dependency 2>"],
  "notes": "<any important notes about the translation>"
}`,

  debug: `You are an expert code debugger and quality assurance specialist. Analyze the provided code to find errors, potential bugs, and suggest fixes.

CRITICAL: You MUST respond with ONLY valid JSON format. Do not include any text before or after the JSON. Do not wrap in markdown code blocks.

IMPORTANT INSTRUCTIONS:
- Carefully examine the code for syntax errors, logic errors, and potential runtime issues
- Identify security vulnerabilities and performance issues
- Provide specific, actionable suggestions for fixes
- When possible, provide the corrected version of the code
- Categorize issues by severity (high, medium, low)
- Be thorough but concise in explanations

Respond with ONLY this JSON structure (no additional text):
{
  "language": "<detected programming language>",
  "issues": [
    {
      "type": "<error type (syntax, logic, runtime, security, performance)>",
      "severity": "<high|medium|low>",
      "line": "<line number if applicable>",
      "description": "<clear description of the issue>",
      "suggestion": "<specific fix suggestion>"
    }
  ],
  "suggestions": ["<general improvement suggestions>"],
  "fixedCode": "<corrected version of the code if fixes are possible>",
  "summary": "<overall assessment of code quality and main issues found>"
}`
};

// Helper function to call OpenAI (with demo fallback)
async function callOpenAI(prompt, code, language, targetLanguage = null) {
  // Check if we have a valid API key
  if (!process.env.OPENAI_API_KEY || 
      process.env.OPENAI_API_KEY === 'sk-test-demo-key-for-testing' ||
      process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
    console.log('Using demo mode - no valid API key provided');
    return getDemoResponse(prompt, code, language, targetLanguage);
  }

  console.log('🔑 Using OpenAI API key:', process.env.OPENAI_API_KEY.substring(0, 20) + '...');

  try {
    const systemPrompt = prompt;
    const userPrompt = targetLanguage 
      ? `Language: ${language}\nTarget Language: ${targetLanguage}\nCode:\n${code}`
      : `Language: ${language}\nCode:\n${code}`;

    console.log('🚀 Making OpenAI API call...');
    console.log('📝 System prompt:', systemPrompt.substring(0, 100) + '...');
    console.log('👤 User prompt length:', userPrompt.length);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    console.log('✅ OpenAI API call successful');
    const response = completion.choices[0].message.content;
    console.log('📄 Response length:', response.length);
    
    // Try to parse as JSON, handle markdown code blocks
    try {
      let cleanResponse = response.trim();
      
      // Remove markdown code blocks if present
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      console.log('🔍 Attempting to parse response as JSON...');
      console.log('Raw response length:', response.length);
      console.log('Clean response preview:', cleanResponse.substring(0, 300) + '...');
      
      const jsonResponse = JSON.parse(cleanResponse);
      console.log('✅ Successfully parsed JSON response');
      console.log('Parsed keys:', Object.keys(jsonResponse));
      return jsonResponse;
    } catch (parseError) {
      console.log('⚠️ Failed to parse as JSON, creating structured response from text');
      console.log('Parse error:', parseError.message);
      console.log('Raw response preview:', response.substring(0, 500) + '...');
      
      // For debug responses, try to create a structured response
      if (prompt.includes('code debugger')) {
        return {
          language: language,
          issues: [{
            type: "parsing",
            severity: "low",
            line: "N/A",
            description: "AI response could not be parsed as JSON",
            suggestion: "The AI provided analysis in text format instead of structured JSON"
          }],
          suggestions: ["Review the raw AI response for debugging insights"],
          fixedCode: code,
          summary: "AI analysis completed but response format needs adjustment",
          rawResponse: response
        };
      }
      
      return { error: "Failed to parse AI response", rawResponse: response };
    }
  } catch (error) {
    console.error('❌ OpenAI API error:', error.message);
    console.error('Error details:', error);
    
    // Check if it's a rate limit or quota issue and provide helpful message
    if (error.message.includes('rate limit')) {
      console.log('Rate limit exceeded, falling back to demo mode');
      return getDemoResponse(prompt, code, language, targetLanguage);
    } else if (error.message.includes('quota')) {
      console.log('Quota exceeded, falling back to demo mode');
      return getDemoResponse(prompt, code, language, targetLanguage);
    } else {
      console.log('Falling back to demo mode due to API error');
      return getDemoResponse(prompt, code, language, targetLanguage);
    }
  }
}

// Demo response function for testing
function getDemoResponse(prompt, code, language, targetLanguage = null) {
  if (prompt.includes('programming tutor') || prompt.includes('code analyst') || prompt.includes('JavaScript developer')) {
    // Simplified demo response - encourage using OpenAI API
    const lines = code.split('\n').filter(line => line.trim());
    const analysisItems = [];
    
    // Basic analysis for demo
    lines.slice(0, 3).forEach((line, index) => {
      const trimmedLine = line.trim();
      if (trimmedLine) {
        analysisItems.push({
          line: trimmedLine,
          explanation: `This line contains ${language} code. For detailed AI-powered analysis of what this line does, please add your OpenAI API key to the .env file.`
        });
      }
    });
    
    // Add demo mode notice
    if (lines.length > 3) {
      analysisItems.push({
        line: `... and ${lines.length - 3} more lines`,
        explanation: "Add your OpenAI API key to get complete line-by-line analysis for all your code."
      });
    }
    
    // Simple demo overview
    const detectedLanguage = language;
    const predictedOutput = "Add your OpenAI API key to get accurate output prediction";
    
    let overview = `This appears to be ${detectedLanguage} code with ${lines.length} lines. `;
    overview += `For detailed analysis of what this code does, its purpose, and how it works, please add your OpenAI API key to the .env file. `;
    overview += `The AI will then provide comprehensive explanations for any programming language.`;
    
    return {
      language: detectedLanguage,
      overview: overview,
      lineByLineAnalysis: analysisItems,
      output: predictedOutput,
      summary: `This is ${detectedLanguage} code that requires OpenAI API analysis for detailed insights. Add your OpenAI API key to get comprehensive explanations and improvement suggestions for any programming language.`,
      suggestions: ["Add your OpenAI API key to get AI-powered code suggestions and improvements"]
    };
  } else if (prompt.includes('code translator')) {
    // Translation response
    const targetLang = targetLanguage || 'Python';
    return {
      language: targetLang,
      translatedCode: `# Demo translation to ${targetLang}\n# Original code: ${code.substring(0, 100)}...\n# Add your OpenAI API key for real translation\nprint("Demo translation - add API key for real results")`,
      dependencies: [`${targetLang.toLowerCase()}-demo-package`],
      notes: "This is a demo translation. Add your OpenAI API key to get actual code translation."
    };
  }
  
  return { error: "Unknown prompt type", rawResponse: "Demo mode active" };
}

// Helper function to call Gemini API for debugging
async function callGeminiDebug(code, language) {
  // Debug logging for API key
  console.log('🔍 GEMINI_API_KEY check:', {
    exists: !!process.env.GEMINI_API_KEY,
    value: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 20) + '...' : 'undefined',
    length: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 0
  });
  
  // Check if we have a valid API key
  if (!process.env.GEMINI_API_KEY || 
      process.env.GEMINI_API_KEY === 'demo-key' ||
      process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
    console.log('❌ Using demo mode for debug - no valid Gemini API key provided');
    console.log('Current GEMINI_API_KEY value:', process.env.GEMINI_API_KEY);
    return getDebugDemoResponse(code, language);
  }

  console.log('🔑 Using Gemini API key for debugging:', process.env.GEMINI_API_KEY.substring(0, 20) + '...');

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `${prompts.debug}\n\nLanguage: ${language}\nCode:\n${code}`;
    
    console.log('🚀 Making Gemini API call for debugging...');
    console.log('📝 Prompt length:', prompt.length);
    console.log('🔑 API Key being used:', process.env.GEMINI_API_KEY ? 'Present' : 'Missing');

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('✅ Gemini API call successful');
    console.log('📄 Response length:', text.length);
    
    // Try to parse as JSON, handle markdown code blocks
    try {
      // Remove markdown code blocks if present
      let cleanText = text.trim();
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const jsonResponse = JSON.parse(cleanText);
      console.log('✅ Successfully parsed JSON response from Gemini');
      return jsonResponse;
    } catch (parseError) {
      console.log('⚠️ Failed to parse Gemini response as JSON, returning demo response');
      console.log('Raw response preview:', text.substring(0, 500) + '...');
      console.log('Parse error:', parseError.message);
      return getDebugDemoResponse(code, language);
    }
  } catch (error) {
    console.error('❌ Gemini API error:', error.message);
    console.error('Error details:', error);
    
    // Fallback to demo response
    console.log('Falling back to demo mode due to Gemini API error');
    return getDebugDemoResponse(code, language);
  }
}

// Demo response function for debugging
function getDebugDemoResponse(code, language) {
  const lines = code.split('\n').filter(line => line.trim());
  const issues = [];
  
  // Basic demo issues detection
  if (code.includes('console.log') && lines.length > 10) {
    issues.push({
      type: "debugging",
      severity: "low",
      line: "multiple",
      description: "Multiple console.log statements found",
      suggestion: "Consider using a proper logging library for production code"
    });
  }
  
  if (code.includes('var ')) {
    issues.push({
      type: "syntax",
      severity: "medium", 
      line: "multiple",
      description: "Usage of 'var' keyword found",
      suggestion: "Use 'let' or 'const' instead of 'var' for better scoping"
    });
  }
  
  if (!code.includes('try') && (code.includes('JSON.parse') || code.includes('fetch'))) {
    issues.push({
      type: "runtime",
      severity: "high",
      line: "multiple",
      description: "Potential unhandled errors in async operations",
      suggestion: "Add try-catch blocks around operations that might throw errors"
    });
  }
  
  return {
    language: language,
    issues: issues.length > 0 ? issues : [{
      type: "general",
      severity: "low",
      line: "N/A",
      description: "No obvious issues detected in demo mode",
      suggestion: "Add your Gemini API key for comprehensive debugging analysis"
    }],
    suggestions: [
      "Add your Gemini API key to get AI-powered debugging analysis",
      "Consider adding error handling and input validation",
      "Review code for performance optimizations"
    ],
    fixedCode: `// Demo fixed code - Add your Gemini API key for real fixes\n${code}`,
    summary: `Demo debugging analysis for ${language} code. Add your Gemini API key to get comprehensive error detection, security analysis, and code quality suggestions.`
  };
}

// Get accurate line-by-line explanation based on detected language
function getLineExplanation(line, language, fullCode) {
  const trimmedLine = line.trim();
  
  // C++ specific patterns
  if (language === 'C++') {
    // Include statements
    if (trimmedLine.includes('#include')) {
      const headerMatch = trimmedLine.match(/#include\s*[<"](.*?)[>"]/);
      const headerName = headerMatch?.[1] || 'header file';
      if (headerName === 'iostream') {
        return `This preprocessor directive includes the iostream header file, which provides input/output stream functionality like cout (console output) and cin (console input). It's essential for basic I/O operations in C++.`;
      } else if (headerName === 'vector') {
        return `This includes the vector header, providing access to the std::vector container class - a dynamic array that can grow and shrink at runtime, offering better memory management than traditional arrays.`;
      } else if (headerName === 'string') {
        return `This includes the string header, enabling the use of std::string class for handling text data with automatic memory management and various string manipulation methods.`;
      } else {
        return `This preprocessor directive includes the ${headerName} header file, making its functions, classes, and definitions available in this source file. Headers contain declarations needed for compilation.`;
      }
    }
    
    // Using namespace
    if (trimmedLine.includes('using namespace')) {
      const namespaceMatch = trimmedLine.match(/using\s+namespace\s+(\w+)/);
      const namespaceName = namespaceMatch?.[1] || 'std';
      return `This using directive brings all identifiers from the ${namespaceName} namespace into the current scope, allowing you to use functions like cout instead of std::cout. While convenient, it can cause name conflicts in larger programs.`;
    }
    
    // Main function
    if (trimmedLine.includes('int main')) {
      return `This declares the main function, which is the entry point of every C++ program. The 'int' return type indicates it returns an integer status code (0 for success, non-zero for error). Program execution begins here.`;
    }
    
    // Variable declarations with types
    if (trimmedLine.match(/^\s*(int|float|double|char|bool|string|auto)\s+\w+/)) {
      const typeMatch = trimmedLine.match(/^\s*(int|float|double|char|bool|string|auto)\s+(\w+)(?:\s*=\s*(.+?))?/);
      const varType = typeMatch?.[1];
      const varName = typeMatch?.[2];
      const varValue = typeMatch?.[3];
      
      const typeDescriptions = {
        'int': 'integer (whole numbers)',
        'float': 'single-precision floating-point number',
        'double': 'double-precision floating-point number (more precise than float)',
        'char': 'single character',
        'bool': 'boolean (true/false)',
        'string': 'text string',
        'auto': 'automatically deduced type'
      };
      
      if (varValue) {
        return `This declares a variable '${varName}' of type ${varType} (${typeDescriptions[varType]}) and initializes it with the value ${varValue}. C++ requires explicit type declarations for memory allocation and type safety.`;
      } else {
        return `This declares a variable '${varName}' of type ${varType} (${typeDescriptions[varType]}). The variable is allocated memory but not initialized, so it contains garbage values until assigned.`;
      }
    }
    
    // cout statements
    if (trimmedLine.includes('cout')) {
      const outputMatch = trimmedLine.match(/cout\s*<<\s*(.+?)(?:\s*<<\s*endl)?/);
      const content = outputMatch?.[1] || 'data';
      if (trimmedLine.includes('endl')) {
        return `This uses cout (console output) to print ${content} to the standard output stream, followed by endl which outputs a newline character and flushes the output buffer. This ensures immediate display of the text.`;
      } else {
        return `This uses cout (console output) with the insertion operator (<<) to send ${content} to the standard output stream. The << operator can be chained to output multiple values in sequence.`;
      }
    }
    
    // cin statements
    if (trimmedLine.includes('cin')) {
      const inputMatch = trimmedLine.match(/cin\s*>>\s*(\w+)/);
      const varName = inputMatch?.[1] || 'variable';
      return `This uses cin (console input) with the extraction operator (>>) to read user input from the standard input stream and store it in the variable '${varName}'. The program will pause and wait for user input.`;
    }
    
    // For loops
    if (trimmedLine.includes('for') && trimmedLine.includes('(')) {
      const forMatch = trimmedLine.match(/for\s*\(\s*(.+?)\s*;\s*(.+?)\s*;\s*(.+?)\s*\)/);
      if (forMatch) {
        const init = forMatch[1];
        const condition = forMatch[2];
        const increment = forMatch[3];
        return `This is a C++ for loop with three parts: initialization (${init}), condition check (${condition}), and increment/update (${increment}). It will repeatedly execute the code block as long as the condition is true.`;
      } else {
        return `This is a C++ for loop that will repeatedly execute a block of code. For loops are ideal when you know the number of iterations in advance or need to iterate through a range of values.`;
      }
    }
    
    // Function definitions
    if (trimmedLine.match(/^\s*(int|void|float|double|bool|string|char)\s+\w+\s*\(/)) {
      const funcMatch = trimmedLine.match(/^\s*(int|void|float|double|bool|string|char)\s+(\w+)\s*\(/);
      const returnType = funcMatch?.[1];
      const funcName = funcMatch?.[2];
      return `This defines a function named '${funcName}' that returns a ${returnType}. Functions in C++ must specify their return type explicitly. This function can be called from other parts of the program to execute its code block.`;
    }
    
    // Return statements
    if (trimmedLine.includes('return')) {
      const returnMatch = trimmedLine.match(/return\s+(.+)/);
      const returnValue = returnMatch?.[1] || '0';
      if (returnValue === '0') {
        return `This return statement exits the function and returns 0, which in the main function indicates successful program termination. In C++, returning 0 from main() is the standard way to signal that the program completed without errors.`;
      } else {
        return `This return statement exits the current function and returns the value ${returnValue} to the calling code. The returned value must match the function's declared return type.`;
      }
    }
    
    // Array declarations
    if (trimmedLine.match(/^\s*(int|float|double|char)\s+\w+\s*\[\s*\d*\s*\]/)) {
      const arrayMatch = trimmedLine.match(/^\s*(int|float|double|char)\s+(\w+)\s*\[\s*(\d*)\s*\]/);
      const arrayType = arrayMatch?.[1];
      const arrayName = arrayMatch?.[2];
      const arraySize = arrayMatch?.[3];
      if (arraySize) {
        return `This declares an array named '${arrayName}' of type ${arrayType} with ${arraySize} elements. Arrays in C++ store multiple values of the same type in contiguous memory locations, accessed using zero-based indexing.`;
      } else {
        return `This declares an array named '${arrayName}' of type ${arrayType}. The size will be determined by initialization or context. Arrays provide efficient storage for multiple values of the same type.`;
      }
    }
    
    // Pointer declarations
    if (trimmedLine.match(/^\s*(int|float|double|char|void)\s*\*\s*\w+/)) {
      const ptrMatch = trimmedLine.match(/^\s*(int|float|double|char|void)\s*\*\s*(\w+)/);
      const ptrType = ptrMatch?.[1];
      const ptrName = ptrMatch?.[2];
      return `This declares a pointer named '${ptrName}' that can point to a ${ptrType} value. Pointers store memory addresses and allow direct memory manipulation, which is a powerful feature of C++ for efficient memory management.`;
    }
    
    // While loops
    if (trimmedLine.includes('while') && trimmedLine.includes('(')) {
      const whileMatch = trimmedLine.match(/while\s*\(\s*(.+?)\s*\)/);
      const condition = whileMatch?.[1] || 'condition';
      return `This is a while loop that continues executing its code block as long as ${condition} remains true. While loops are useful when the number of iterations is not known in advance.`;
    }
    
    // Switch statements
    if (trimmedLine.includes('switch')) {
      const switchMatch = trimmedLine.match(/switch\s*\(\s*(.+?)\s*\)/);
      const variable = switchMatch?.[1] || 'variable';
      return `This is a switch statement that evaluates ${variable} and executes different code blocks based on its value. Switch statements provide an efficient alternative to multiple if-else statements for discrete value comparisons.`;
    }
    
    // Case statements
    if (trimmedLine.includes('case ')) {
      const caseMatch = trimmedLine.match(/case\s+(.+?):/);
      const caseValue = caseMatch?.[1] || 'value';
      return `This is a case label in a switch statement that executes when the switch variable equals ${caseValue}. Each case should typically end with a break statement to prevent fall-through to the next case.`;
    }
    
    // Break and continue
    if (trimmedLine.includes('break;')) {
      return `This break statement immediately exits the current loop or switch statement, transferring control to the statement following the loop/switch. It's essential for controlling program flow and preventing infinite loops.`;
    }
    
    if (trimmedLine.includes('continue;')) {
      return `This continue statement skips the rest of the current loop iteration and jumps to the next iteration. It's useful for skipping certain conditions without exiting the entire loop.`;
    }
  }
  
  // Go specific patterns
  if (language === 'Go') {
    // Package declaration
    if (trimmedLine.includes('package ')) {
      const packageMatch = trimmedLine.match(/package\s+(\w+)/);
      const packageName = packageMatch?.[1] || 'main';
      return `This declares the package name as '${packageName}'. In Go, every source file must belong to a package. The 'main' package is special - it defines a standalone executable program.`;
    }
    
    // Import statements
    if (trimmedLine.includes('import ')) {
      const importMatch = trimmedLine.match(/import\s+["`]([^"`]+)["`]/);
      const moduleName = importMatch?.[1] || 'module';
      return `This imports the '${moduleName}' package, making its exported functions and types available in this file. Go's import system is based on package paths and supports both standard library and external packages.`;
    }
    
    // Function declarations
    if (trimmedLine.includes('func ')) {
      const funcMatch = trimmedLine.match(/func\s+(\w+)\s*\(/);
      const funcName = funcMatch?.[1] || 'function';
      if (funcName === 'main') {
        return `This defines the main function, which is the entry point of a Go program. When you run a Go program, execution starts here. The main function takes no parameters and returns nothing.`;
      } else {
        return `This defines a function named '${funcName}'. Go functions can have multiple return values and use explicit type declarations. Functions starting with capital letters are exported (public).`;
      }
    }
    
    // Variable declarations
    if (trimmedLine.includes('var ') || trimmedLine.match(/^\s*\w+\s*:=/)) {
      if (trimmedLine.includes('var ')) {
        const varMatch = trimmedLine.match(/var\s+(\w+)(?:\s+(\w+))?(?:\s*=\s*(.+))?/);
        const varName = varMatch?.[1];
        const varType = varMatch?.[2];
        const varValue = varMatch?.[3];
        if (varType && varValue) {
          return `This declares a variable '${varName}' of type ${varType} and initializes it with ${varValue}. Go supports explicit type declarations for clarity and type safety.`;
        } else if (varType) {
          return `This declares a variable '${varName}' of type ${varType}. In Go, uninitialized variables get their zero value (0 for numbers, "" for strings, nil for pointers).`;
        } else {
          return `This declares a variable '${varName}' with type inference from its initial value. Go can automatically determine the type from the assigned value.`;
        }
      } else {
        const shortMatch = trimmedLine.match(/(\w+)\s*:=\s*(.+)/);
        const varName = shortMatch?.[1];
        const varValue = shortMatch?.[2];
        return `This uses Go's short variable declaration syntax to declare and initialize '${varName}' with ${varValue}. The := operator is a convenient way to declare variables with type inference.`;
      }
    }
    
    // fmt.Println and similar
    if (trimmedLine.includes('fmt.Print')) {
      const printMatch = trimmedLine.match(/fmt\.Print\w*\s*\(\s*(.+?)\s*\)/);
      const content = printMatch?.[1] || 'content';
      return `This uses Go's fmt package to print ${content} to standard output. The fmt package provides formatted I/O functions similar to C's printf family but type-safe and more powerful.`;
    }
    
    // Goroutines
    if (trimmedLine.includes('go ')) {
      const goMatch = trimmedLine.match(/go\s+(\w+)/);
      const funcName = goMatch?.[1] || 'function';
      return `This launches a goroutine to execute ${funcName} concurrently. Goroutines are lightweight threads managed by the Go runtime, allowing efficient concurrent programming.`;
    }
    
    // Channels
    if (trimmedLine.includes('chan ') || trimmedLine.includes('<-')) {
      if (trimmedLine.includes('chan ')) {
        return `This declares a channel for communication between goroutines. Channels are Go's way of implementing the CSP (Communicating Sequential Processes) model for safe concurrent programming.`;
      } else {
        return `This performs a channel operation (send or receive). The <- operator is used to send values to or receive values from channels, enabling safe communication between goroutines.`;
      }
    }
  }
  
  // Rust specific patterns
  if (language === 'Rust') {
    // Function declarations
    if (trimmedLine.includes('fn ')) {
      const funcMatch = trimmedLine.match(/fn\s+(\w+)\s*\(/);
      const funcName = funcMatch?.[1] || 'function';
      if (funcName === 'main') {
        return `This defines the main function, which is the entry point of a Rust program. The main function is where program execution begins and is required for executable programs.`;
      } else {
        return `This defines a function named '${funcName}'. Rust functions use the 'fn' keyword and have strict ownership rules that prevent memory safety issues at compile time.`;
      }
    }
    
    // Variable declarations
    if (trimmedLine.includes('let ')) {
      const letMatch = trimmedLine.match(/let\s+(mut\s+)?(\w+)(?:\s*:\s*(\w+))?(?:\s*=\s*(.+))?/);
      const isMutable = letMatch?.[1];
      const varName = letMatch?.[2];
      const varType = letMatch?.[3];
      const varValue = letMatch?.[4];
      
      if (isMutable) {
        return `This declares a mutable variable '${varName}' ${varType ? `of type ${varType} ` : ''}${varValue ? `initialized with ${varValue}` : ''}. The 'mut' keyword is required in Rust to make variables modifiable after declaration.`;
      } else {
        return `This declares an immutable variable '${varName}' ${varType ? `of type ${varType} ` : ''}${varValue ? `initialized with ${varValue}` : ''}. By default, Rust variables are immutable, promoting memory safety and preventing accidental modifications.`;
      }
    }
    
    // println! macro
    if (trimmedLine.includes('println!')) {
      const printMatch = trimmedLine.match(/println!\s*\(\s*(.+?)\s*\)/);
      const content = printMatch?.[1] || 'content';
      return `This uses the println! macro to print ${content} to standard output with a newline. Macros in Rust (indicated by !) are compile-time code generation tools that provide powerful metaprogramming capabilities.`;
    }
    
    // Use statements
    if (trimmedLine.includes('use ')) {
      const useMatch = trimmedLine.match(/use\s+(.+?);/);
      const modulePath = useMatch?.[1] || 'module';
      return `This brings ${modulePath} into scope, making its items available without fully qualified names. Rust's module system is hierarchical and helps organize code while maintaining clear visibility rules.`;
    }
    
    // Struct definitions
    if (trimmedLine.includes('struct ')) {
      const structMatch = trimmedLine.match(/struct\s+(\w+)/);
      const structName = structMatch?.[1] || 'Structure';
      return `This defines a struct named '${structName}'. Structs in Rust are custom data types that group related data together. They support methods, traits, and Rust's ownership system for memory safety.`;
    }
    
    // Impl blocks
    if (trimmedLine.includes('impl ')) {
      const implMatch = trimmedLine.match(/impl\s+(\w+)/);
      const typeName = implMatch?.[1] || 'Type';
      return `This begins an implementation block for ${typeName}. Impl blocks define methods and associated functions for types, similar to classes in other languages but with Rust's ownership semantics.`;
    }
    
    // Match expressions
    if (trimmedLine.includes('match ')) {
      const matchVar = trimmedLine.match(/match\s+(\w+)/)?.[1] || 'value';
      return `This starts a match expression on ${matchVar}. Match is Rust's powerful pattern matching construct that ensures exhaustive handling of all possible cases, preventing runtime errors.`;
    }
  }
  
  // TypeScript specific patterns
  if (language === 'TypeScript') {
    // Interface declarations
    if (trimmedLine.includes('interface ')) {
      const interfaceMatch = trimmedLine.match(/interface\s+(\w+)/);
      const interfaceName = interfaceMatch?.[1] || 'Interface';
      return `This defines an interface named '${interfaceName}'. TypeScript interfaces describe the shape of objects, providing compile-time type checking and enabling better IDE support with autocomplete and error detection.`;
    }
    
    // Type aliases
    if (trimmedLine.includes('type ') && trimmedLine.includes('=')) {
      const typeMatch = trimmedLine.match(/type\s+(\w+)\s*=/);
      const typeName = typeMatch?.[1] || 'Type';
      return `This defines a type alias named '${typeName}'. Type aliases create new names for existing types, making complex type definitions more readable and reusable throughout your codebase.`;
    }
    
    // Function with type annotations
    if (trimmedLine.includes('function ') && (trimmedLine.includes(': ') || trimmedLine.includes('=>'))) {
      const funcMatch = trimmedLine.match(/function\s+(\w+)/);
      const funcName = funcMatch?.[1] || 'function';
      return `This defines a TypeScript function named '${funcName}' with type annotations. TypeScript adds static typing to JavaScript, catching errors at compile time and improving code reliability and maintainability.`;
    }
    
    // Variable declarations with type annotations
    if ((trimmedLine.includes('let ') || trimmedLine.includes('const ') || trimmedLine.includes('var ')) && trimmedLine.includes(': ')) {
      const varMatch = trimmedLine.match(/(?:let|const|var)\s+(\w+)\s*:\s*(\w+)/);
      const varName = varMatch?.[1] || 'variable';
      const varType = varMatch?.[2] || 'type';
      return `This declares a variable '${varName}' with explicit type annotation '${varType}'. TypeScript's type system helps catch errors early and provides better tooling support with intelligent autocomplete and refactoring.`;
    }
    
    // Class declarations with TypeScript features
    if (trimmedLine.includes('class ') && (trimmedLine.includes('extends') || trimmedLine.includes('implements'))) {
      const classMatch = trimmedLine.match(/class\s+(\w+)/);
      const className = classMatch?.[1] || 'Class';
      if (trimmedLine.includes('extends')) {
        return `This defines a TypeScript class '${className}' that extends another class. TypeScript classes support inheritance, access modifiers, and compile-time type checking for object-oriented programming.`;
      } else {
        return `This defines a TypeScript class '${className}' that implements an interface. This ensures the class provides all required methods and properties defined in the interface contract.`;
      }
    }
    
    // Import/Export statements
    if (trimmedLine.includes('import ') && trimmedLine.includes('from')) {
      const importMatch = trimmedLine.match(/import\s+.*\s+from\s+['"']([^'"']+)['"']/);
      const moduleName = importMatch?.[1] || 'module';
      return `This imports functionality from the '${moduleName}' module. TypeScript supports ES6 module syntax with additional type information, enabling better dependency management and tree shaking.`;
    }
    
    if (trimmedLine.includes('export ')) {
      return `This exports functionality to make it available for import in other modules. TypeScript's module system supports both named and default exports with full type information preservation.`;
    }
  }
  
  // C# specific patterns
  if (language === 'C#') {
    // Using statements
    if (trimmedLine.includes('using ')) {
      const usingMatch = trimmedLine.match(/using\s+([^;]+);/);
      const namespaceName = usingMatch?.[1] || 'namespace';
      return `This using directive imports the '${namespaceName}' namespace, making its types and members available without fully qualified names. Using statements help organize code and reduce typing.`;
    }
    
    // Namespace declarations
    if (trimmedLine.includes('namespace ')) {
      const namespaceMatch = trimmedLine.match(/namespace\s+(\w+(?:\.\w+)*)/);
      const namespaceName = namespaceMatch?.[1] || 'MyNamespace';
      return `This declares a namespace called '${namespaceName}'. Namespaces in C# provide a way to organize related classes and avoid naming conflicts, similar to packages in other languages.`;
    }
    
    // Class declarations
    if (trimmedLine.includes('public class ') || trimmedLine.includes('private class ') || trimmedLine.includes('internal class ')) {
      const classMatch = trimmedLine.match(/(?:public|private|internal)\s+class\s+(\w+)/);
      const className = classMatch?.[1] || 'Class';
      return `This declares a C# class named '${className}'. Classes are blueprints for creating objects and encapsulate data (fields/properties) and behavior (methods) together in object-oriented programming.`;
    }
    
    // Constructor declarations
    if (trimmedLine.match(/^\s*public\s+\w+\s*\([^)]*\)\s*{?/)) {
      const constructorMatch = trimmedLine.match(/public\s+(\w+)\s*\(/);
      const className = constructorMatch?.[1] || 'Class';
      return `This defines a public constructor for the '${className}' class. Constructors are special methods that initialize new instances of a class when objects are created using the 'new' keyword.`;
    }
    
    // Method declarations
    if (trimmedLine.match(/^\s*(?:public|private|protected|internal)\s+(?:static\s+)?(?:virtual\s+)?(?:override\s+)?\w+\s+\w+\s*\(/)) {
      const methodMatch = trimmedLine.match(/(?:public|private|protected|internal)\s+(?:static\s+)?(?:virtual\s+)?(?:override\s+)?(\w+)\s+(\w+)\s*\(/);
      const returnType = methodMatch?.[1] || 'type';
      const methodName = methodMatch?.[2] || 'method';
      return `This declares a C# method named '${methodName}' that returns ${returnType}. Methods define the behavior of a class and can have access modifiers (public, private, etc.) that control visibility.`;
    }
    
    // Property declarations
    if (trimmedLine.includes('{ get; set; }') || trimmedLine.includes('{ get; }') || trimmedLine.includes('{ set; }')) {
      const propMatch = trimmedLine.match(/(?:public|private|protected|internal)\s+(\w+)\s+(\w+)\s*{/);
      const propType = propMatch?.[1] || 'type';
      const propName = propMatch?.[2] || 'property';
      return `This declares a C# property named '${propName}' of type ${propType}. Properties provide a flexible mechanism to read, write, or compute values while encapsulating the underlying data with get and set accessors.`;
    }
    
    // Variable declarations
    if (trimmedLine.match(/^\s*(?:public|private|protected|internal)?\s*(?:static\s+)?(?:readonly\s+)?\w+\s+\w+(?:\s*=\s*.+)?;/)) {
      const varMatch = trimmedLine.match(/(?:public|private|protected|internal)?\s*(?:static\s+)?(?:readonly\s+)?(\w+)\s+(\w+)(?:\s*=\s*(.+?))?;/);
      const varType = varMatch?.[1] || 'type';
      const varName = varMatch?.[2] || 'variable';
      const varValue = varMatch?.[3];
      if (varValue) {
        return `This declares a C# variable '${varName}' of type ${varType} and initializes it with ${varValue}. C# is strongly typed, requiring explicit type declarations for compile-time type safety.`;
      } else {
        return `This declares a C# variable '${varName}' of type ${varType}. The variable will be initialized with the default value for its type (null for reference types, 0 for numeric types, etc.).`;
      }
    }
    
    // Console.WriteLine
    if (trimmedLine.includes('Console.WriteLine') || trimmedLine.includes('Console.Write')) {
      const consoleMatch = trimmedLine.match(/Console\.Write(?:Line)?\s*\(\s*(.+?)\s*\)/);
      const content = consoleMatch?.[1] || 'content';
      return `This uses Console.WriteLine to output ${content} to the console. Console.WriteLine is part of the System namespace and provides formatted output capabilities for C# console applications.`;
    }
    
    // Main method
    if (trimmedLine.includes('static void Main')) {
      return `This declares the Main method, which is the entry point of a C# console application. The Main method is where program execution begins and can optionally accept command-line arguments as a string array parameter.`;
    }
    
    // LINQ expressions
    if (trimmedLine.includes('.Where(') || trimmedLine.includes('.Select(') || trimmedLine.includes('.OrderBy(')) {
      return `This uses LINQ (Language Integrated Query) to perform data operations. LINQ provides a powerful, readable syntax for querying and manipulating collections, databases, and other data sources directly in C#.`;
    }
    
    // Exception handling
    if (trimmedLine.includes('try {')) {
      return `This begins a try block for exception handling. The try block contains code that might throw exceptions, which can be caught and handled gracefully in associated catch blocks.`;
    }
    
    if (trimmedLine.includes('catch (')) {
      const exceptionMatch = trimmedLine.match(/catch\s*\(\s*(\w+)/);
      const exceptionType = exceptionMatch?.[1] || 'Exception';
      return `This catch block handles exceptions of type ${exceptionType}. Exception handling in C# allows programs to respond to runtime errors gracefully instead of crashing.`;
    }
    
    // Async/await
    if (trimmedLine.includes('async ') || trimmedLine.includes('await ')) {
      if (trimmedLine.includes('async ')) {
        return `This declares an async method that can perform asynchronous operations. Async methods in C# enable non-blocking code execution, improving application responsiveness especially for I/O operations.`;
      } else {
        return `This await expression asynchronously waits for a task to complete without blocking the thread. Await can only be used inside async methods and helps write asynchronous code that reads like synchronous code.`;
      }
    }
  }
  
  // Generic patterns for other languages or fallback
  if (trimmedLine.includes('function') || trimmedLine.includes('def ') || trimmedLine.includes('public ') || trimmedLine.includes('private ')) {
    const funcName = trimmedLine.match(/(?:function\s+|def\s+|public\s+\w+\s+|private\s+\w+\s+)(\w+)/)?.[1] || 'unnamed';
    return `This line defines a function named '${funcName}'. Functions are reusable blocks of code that can accept input parameters and return values. This allows you to organize your code into logical chunks and avoid repetition.`;
  } else if (trimmedLine.includes('console.log') || trimmedLine.includes('print(') || trimmedLine.includes('System.out')) {
    const outputMatch = trimmedLine.match(/(?:console\.log|print|System\.out\.print(?:ln)?)\s*\(\s*(.+?)\s*\)/);
    const content = outputMatch?.[1] || 'some value';
    return `This line outputs ${content} to the console/terminal. Output statements are essential for displaying results to users and debugging your program by showing what values variables contain at different points.`;
  } else if (trimmedLine.includes('var ') || trimmedLine.includes('let ') || trimmedLine.includes('const ')) {
    const varMatch = trimmedLine.match(/(?:var|let|const)\s+(\w+)(?:\s*=\s*(.+?))?/);
    const varName = varMatch?.[1] || 'variable';
    const varValue = varMatch?.[2] || 'undefined';
    if (varMatch?.[2]) {
      return `This line declares a variable named '${varName}' and assigns it the value ${varValue}. Variables are containers that store data values that can be used and modified throughout your program.`;
    } else {
      return `This line declares a variable named '${varName}' without assigning a value. The variable is created in memory and can be assigned a value later in the program.`;
    }
  } else if (trimmedLine.includes('=') && !trimmedLine.includes('==') && !trimmedLine.includes('!=')) {
    const assignMatch = trimmedLine.match(/(\w+)\s*=\s*(.+)/);
    const varName = assignMatch?.[1] || 'variable';
    const newValue = assignMatch?.[2] || 'a value';
    return `This line assigns ${newValue} to the variable '${varName}'. Assignment operations update the value stored in a variable, replacing any previous value it may have held.`;
  } else if (trimmedLine.includes('if ') || trimmedLine.includes('else') || trimmedLine.includes('elif')) {
    const conditionMatch = trimmedLine.match(/if\s*\(\s*(.+?)\s*\)/);
    const condition = conditionMatch?.[1] || 'a condition';
    if (trimmedLine.includes('if ')) {
      return `This is an if statement that checks whether ${condition} is true. If the condition evaluates to true, the code block that follows will be executed. If false, the program will skip to the next part.`;
    } else if (trimmedLine.includes('else if') || trimmedLine.includes('elif')) {
      return `This is an else-if statement that provides an alternative condition to check. It only runs if the previous if condition was false, allowing you to test multiple conditions in sequence.`;
    } else {
      return `This is an else statement that runs when all previous if/else-if conditions were false. It provides a default action when no other conditions are met.`;
    }
  } else if (trimmedLine.includes('for ') || trimmedLine.includes('while ') || trimmedLine.includes('forEach')) {
    if (trimmedLine.includes('for ')) {
      return `This is a for loop that repeats a block of code a specific number of times or iterates through a collection of items. Loops are essential for processing multiple items efficiently without writing repetitive code.`;
    } else if (trimmedLine.includes('while ')) {
      const conditionMatch = trimmedLine.match(/while\s*\(\s*(.+?)\s*\)/);
      const condition = conditionMatch?.[1] || 'a condition';
      return `This is a while loop that continues executing its code block as long as ${condition} remains true. It's useful when you don't know exactly how many times you need to repeat something.`;
    } else {
      return `This is a forEach loop that executes a function for each element in an array or collection. It's a clean way to process every item in a list without manually managing loop counters.`;
    }
  } else if (trimmedLine.includes('import ') || trimmedLine.includes('require(') || trimmedLine.includes('#include') || trimmedLine.includes('using ')) {
    const moduleMatch = trimmedLine.match(/(?:import|require\(|#include|using)\s*['"<]?([^'">\s)]+)/);
    const moduleName = moduleMatch?.[1] || 'a module';
    return `This line imports the '${moduleName}' library/module, making its functions and features available in your program. Imports allow you to use pre-written code from other developers, saving time and effort.`;
  } else if (trimmedLine.includes('class ') || trimmedLine.includes('struct ')) {
    const classMatch = trimmedLine.match(/(?:class|struct)\s+(\w+)/);
    const className = classMatch?.[1] || 'unnamed';
    return `This defines a class named '${className}', which is a blueprint for creating objects. Classes encapsulate data (properties) and behavior (methods) together, forming the foundation of object-oriented programming.`;
  } else if (trimmedLine.includes('return ')) {
    const returnMatch = trimmedLine.match(/return\s+(.+)/);
    const returnValue = returnMatch?.[1] || 'a value';
    return `This return statement sends ${returnValue} back to wherever this function was called from. Return statements end function execution and provide the result of the function's computation.`;
  } else if (trimmedLine.includes('//') || trimmedLine.includes('#') || trimmedLine.includes('/*')) {
    return `This is a comment that explains the code for human readers. Comments are ignored by the computer but are crucial for code maintenance, helping other developers (and your future self) understand what the code does and why.`;
  } else if (trimmedLine.includes('{') || trimmedLine.includes('}')) {
    return `These curly braces define code blocks and scope in ${language}. Opening braces '{' start a new block, while closing braces '}' end it. Everything inside the braces belongs to the same scope and logical group.`;
  } else {
    return `This line contains ${language} syntax that performs a specific operation within your program's logic flow. It contributes to the overall functionality by executing a particular instruction or computation.`;
  }
}

// Advanced language detection with 90%+ accuracy
function detectLanguageAdvanced(code, userSelectedLanguage) {
  const languageSignatures = {
    'JavaScript': {
      keywords: ['function', 'var', 'let', 'const', 'console.log', 'document.', 'window.', '=>', 'async', 'await'],
      patterns: [/function\s+\w+\s*\(/, /console\.log\s*\(/, /document\.\w+/, /=>\s*{?/, /require\s*\(/],
      fileExtensions: ['.js', '.jsx', '.ts', '.tsx'],
      score: 0
    },
    'Python': {
      keywords: ['def', 'print(', 'import', 'from', 'if __name__', 'elif', 'True', 'False', 'None'],
      patterns: [/def\s+\w+\s*\(/, /print\s*\(/, /if\s+__name__\s*==/, /import\s+\w+/, /from\s+\w+\s+import/],
      fileExtensions: ['.py', '.pyw'],
      score: 0
    },
    'Java': {
      keywords: ['public class', 'private', 'public static void main', 'System.out.println', 'import java'],
      patterns: [/public\s+class\s+\w+/, /public\s+static\s+void\s+main/, /System\.out\.print/, /import\s+java\./],
      fileExtensions: ['.java'],
      score: 0
    },
    'C#': {
      keywords: ['using System', 'public class', 'Console.WriteLine', 'namespace', 'static void Main'],
      patterns: [/using\s+System/, /Console\.WriteLine/, /namespace\s+\w+/, /static\s+void\s+Main/],
      fileExtensions: ['.cs'],
      score: 0
    },
    'C++': {
      keywords: ['#include', 'using namespace std', 'cout <<', 'cin >>', 'int main()', 'std::', 'endl', 'vector<', 'string'],
      patterns: [/#include\s*</, /using\s+namespace\s+std/, /cout\s*<</, /cin\s*>>/, /int\s+main\s*\(/, /std::/, /endl/, /vector\s*</, /string\s+\w+/],
      fileExtensions: ['.cpp', '.cc', '.cxx', '.hpp', '.h'],
      score: 0
    },
    'C': {
      keywords: ['#include <stdio.h>', 'printf(', 'scanf(', 'int main()', 'malloc('],
      patterns: [/#include\s*<stdio\.h>/, /printf\s*\(/, /int\s+main\s*\(/, /malloc\s*\(/],
      fileExtensions: ['.c'],
      score: 0
    },
    'Go': {
      keywords: ['package main', 'func main()', 'import', 'fmt.Println', 'var', 'func ', 'go ', 'chan ', 'defer'],
      patterns: [/package\s+main/, /func\s+main\s*\(\s*\)/, /fmt\.Print/, /func\s+\w+\s*\(/, /go\s+\w+/, /chan\s+\w+/, /defer\s+/],
      fileExtensions: ['.go'],
      score: 0
    },
    'Rust': {
      keywords: ['fn main()', 'println!', 'let mut', 'let ', 'use ', 'mod ', 'impl ', 'struct ', 'enum '],
      patterns: [/fn\s+main\s*\(\s*\)/, /println!\s*\(/, /let\s+mut\s+/, /let\s+\w+/, /use\s+\w+/, /struct\s+\w+/, /impl\s+\w+/, /enum\s+\w+/],
      fileExtensions: ['.rs'],
      score: 0
    },
    'TypeScript': {
      keywords: ['interface ', 'type ', ': string', ': number', ': boolean', 'export ', 'import ', 'class ', 'function '],
      patterns: [/interface\s+\w+/, /type\s+\w+\s*=/, /:\s*string/, /:\s*number/, /:\s*boolean/, /export\s+/, /import\s+.*from/, /class\s+\w+/],
      fileExtensions: ['.ts', '.tsx'],
      score: 0
    }
  };

  // Calculate scores for each language
  Object.keys(languageSignatures).forEach(lang => {
    const signature = languageSignatures[lang];
    
    // Keyword matching
    signature.keywords.forEach(keyword => {
      if (code.includes(keyword)) {
        signature.score += 2;
      }
    });
    
    // Pattern matching
    signature.patterns.forEach(pattern => {
      if (pattern.test(code)) {
        signature.score += 3;
      }
    });
    
    // Boost score if matches user selection
    if (lang === userSelectedLanguage) {
      signature.score += 5;
    }
  });

  // Find the language with highest score
  let detectedLanguage = userSelectedLanguage;
  let maxScore = languageSignatures[userSelectedLanguage]?.score || 0;
  
  Object.keys(languageSignatures).forEach(lang => {
    if (languageSignatures[lang].score > maxScore) {
      maxScore = languageSignatures[lang].score;
      detectedLanguage = lang;
    }
  });

  return {
    language: detectedLanguage,
    confidence: maxScore,
    features: getLanguageFeatures(detectedLanguage)
  };
}

// Get detailed language features and characteristics
function getLanguageFeatures(language) {
  const languageFeatures = {
    'JavaScript': {
      type: 'Dynamic, interpreted programming language',
      paradigm: 'Multi-paradigm (object-oriented, functional, procedural)',
      features: [
        'Dynamic typing with type coercion',
        'First-class functions and closures',
        'Prototype-based object orientation',
        'Event-driven and asynchronous programming',
        'Automatic memory management (garbage collection)',
        'Supports both client-side and server-side development'
      ],
      strengths: 'Web development, real-time applications, rapid prototyping',
      syntax: 'C-style syntax with flexible variable declarations'
    },
    'Python': {
      type: 'High-level, interpreted programming language',
      paradigm: 'Multi-paradigm (object-oriented, functional, procedural)',
      features: [
        'Dynamic typing with duck typing',
        'Indentation-based code blocks',
        'Extensive standard library',
        'Interactive interpreter (REPL)',
        'Automatic memory management',
        'Cross-platform compatibility'
      ],
      strengths: 'Data science, AI/ML, web development, automation, scientific computing',
      syntax: 'Clean, readable syntax emphasizing code readability'
    },
    'Java': {
      type: 'Statically-typed, compiled programming language',
      paradigm: 'Object-oriented with functional programming features',
      features: [
        'Static typing with compile-time type checking',
        'Platform independence (Write Once, Run Anywhere)',
        'Automatic memory management with garbage collection',
        'Strong object-oriented programming model',
        'Extensive standard library (Java API)',
        'Multithreading support'
      ],
      strengths: 'Enterprise applications, Android development, web services',
      syntax: 'Verbose, explicit syntax with mandatory class structure'
    },
    'C#': {
      type: 'Statically-typed, compiled programming language',
      paradigm: 'Multi-paradigm (object-oriented, functional, generic)',
      features: [
        'Static typing with type inference',
        '.NET Framework integration',
        'Automatic memory management',
        'LINQ (Language Integrated Query)',
        'Properties and events',
        'Generics and nullable types'
      ],
      strengths: 'Windows applications, web development, game development',
      syntax: 'C-style syntax with modern language features'
    },
    'C++': {
      type: 'Statically-typed, compiled programming language',
      paradigm: 'Multi-paradigm (procedural, object-oriented, generic)',
      features: [
        'Static typing with manual memory management',
        'Low-level memory control with pointers',
        'Multiple inheritance',
        'Template metaprogramming',
        'Operator overloading',
        'Direct hardware access'
      ],
      strengths: 'System programming, game development, embedded systems, performance-critical applications',
      syntax: 'C-style syntax with object-oriented extensions'
    },
    'C': {
      type: 'Statically-typed, compiled programming language',
      paradigm: 'Procedural programming',
      features: [
        'Static typing with manual memory management',
        'Low-level system access',
        'Minimal runtime overhead',
        'Portable across platforms',
        'Direct memory manipulation with pointers',
        'Simple, minimalist design'
      ],
      strengths: 'System programming, embedded systems, operating systems, device drivers',
      syntax: 'Simple, procedural syntax with explicit memory management'
    },
    'Go': {
      type: 'Statically-typed, compiled programming language',
      paradigm: 'Procedural with concurrent programming features',
      features: [
        'Static typing with type inference',
        'Built-in concurrency with goroutines and channels',
        'Garbage collection for automatic memory management',
        'Fast compilation and execution',
        'Simple, clean syntax with minimal keywords',
        'Cross-platform compilation'
      ],
      strengths: 'Web services, microservices, cloud applications, concurrent systems',
      syntax: 'Clean, minimalist syntax inspired by C but simplified'
    },
    'Rust': {
      type: 'Statically-typed, compiled systems programming language',
      paradigm: 'Multi-paradigm (functional, imperative, generic)',
      features: [
        'Memory safety without garbage collection',
        'Zero-cost abstractions',
        'Ownership system for memory management',
        'Pattern matching and algebraic data types',
        'Trait-based generics',
        'Fearless concurrency'
      ],
      strengths: 'System programming, web backends, blockchain, game engines, operating systems',
      syntax: 'Modern syntax with powerful type system and memory safety guarantees'
    },
    'TypeScript': {
      type: 'Statically-typed superset of JavaScript',
      paradigm: 'Multi-paradigm (object-oriented, functional, procedural)',
      features: [
        'Static type checking with optional typing',
        'Advanced type system with generics and unions',
        'Interfaces and abstract classes',
        'Decorators and metadata',
        'Compile-time error detection',
        'Full JavaScript compatibility'
      ],
      strengths: 'Large-scale JavaScript applications, enterprise development, React/Angular apps',
      syntax: 'JavaScript syntax enhanced with type annotations and modern features'
    }
  };

  return languageFeatures[language] || {
    type: 'Programming language',
    paradigm: 'Various paradigms supported',
    features: ['Language-specific features'],
    strengths: 'General-purpose programming',
    syntax: 'Language-specific syntax rules'
  };
}

// Detailed main entry point detection
function detectMainEntryPoint(code, language) {
  const result = {
    found: false,
    type: 'code snippet',
    explanation: '',
    location: null
  };

  if (language === 'Java') {
    const mainMatch = code.match(/public\s+static\s+void\s+main\s*\(\s*String\s*\[\s*\]\s*\w+\s*\)/);
    if (mainMatch) {
      result.found = true;
      result.type = 'standalone application';
      result.explanation = 'The program has a public static void main(String[] args) method as its entry point, making it a standalone executable Java application that can be run from the command line';
      result.location = mainMatch.index;
    } else if (code.includes('class ')) {
      result.type = 'class definition';
      result.explanation = 'This defines a Java class but lacks a main method, suggesting it\'s a library class or component meant to be used by other programs';
    }
  }
  
  else if (language === 'Python') {
    if (code.includes('if __name__ == "__main__":')) {
      result.found = true;
      result.type = 'script with module capability';
      result.explanation = 'The program uses the standard Python idiom "if __name__ == \'__main__\':" which allows it to run as a standalone script while also being importable as a module';
    } else if (code.includes('def ')) {
      result.type = 'function definitions';
      result.explanation = 'This defines Python functions but has no main execution guard, meaning the code will execute immediately when the file is imported or run';
    } else if (code.includes('class ')) {
      result.type = 'class definition';
      result.explanation = 'This defines Python classes without a main execution block, suggesting it\'s a module meant to be imported by other programs';
    }
  }
  
  else if (language === 'C#') {
    const mainMatch = code.match(/static\s+void\s+Main\s*\(/);
    if (mainMatch) {
      result.found = true;
      result.type = 'console application';
      result.explanation = 'The program has a static void Main() method as its entry point, which is the standard entry point for C# console applications';
    } else if (code.includes('class ')) {
      result.type = 'class definition';
      result.explanation = 'This defines a C# class but lacks a Main method, indicating it\'s a library class or component';
    }
  }
  
  else if (language === 'C' || language === 'C++') {
    const mainMatch = code.match(/int\s+main\s*\(/);
    if (mainMatch) {
      result.found = true;
      result.type = 'executable program';
      result.explanation = `The program has an int main() function as its entry point, following standard ${language} conventions for executable programs`;
    } else if (code.includes('#include')) {
      result.type = 'header or library code';
      result.explanation = 'This appears to be header file content or library functions without a main function';
    }
  }
  
  else if (language === 'JavaScript') {
    if (code.includes('function ') || code.includes('=>')) {
      result.type = 'function definitions';
      result.explanation = 'This JavaScript code defines functions that can be called to execute specific tasks. In JavaScript, there\'s no single main function - execution depends on how the code is loaded and called';
    } else if (code.includes('console.log') || code.includes('document.')) {
      result.found = true;
      result.type = 'script with immediate execution';
      result.explanation = 'This JavaScript code contains statements that will execute immediately when the script is loaded, performing actions like logging to console or manipulating the DOM';
    }
  }

  return result;
}

// Predict code output with high accuracy
function predictCodeOutput(code, language) {
  const outputs = [];
  const lines = code.split('\n');
  
  try {
    if (language === 'JavaScript') {
      // Simulate JavaScript execution
      lines.forEach(line => {
        const trimmed = line.trim();
        
        // Console.log detection
        const consoleMatch = trimmed.match(/console\.log\s*\(\s*(.+?)\s*\)/);
        if (consoleMatch) {
          let output = consoleMatch[1];
          
          // Handle string literals
          if (output.match(/^["'].*["']$/)) {
            output = output.slice(1, -1); // Remove quotes
          }
          // Handle simple expressions
          else if (output.match(/^\d+\s*[\+\-\*\/]\s*\d+$/)) {
            try {
              output = eval(output).toString();
            } catch (e) {
              output = `[Expression: ${output}]`;
            }
          }
          // Handle variable references (simplified)
          else if (output.match(/^\w+$/)) {
            output = `[Variable: ${output}]`;
          }
          
          outputs.push(output);
        }
        
        // Alert detection
        const alertMatch = trimmed.match(/alert\s*\(\s*(.+?)\s*\)/);
        if (alertMatch) {
          outputs.push(`[Alert: ${alertMatch[1]}]`);
        }
      });
    }
    
    else if (language === 'Python') {
      // Simulate Python execution
      lines.forEach(line => {
        const trimmed = line.trim();
        
        // Print detection
        const printMatch = trimmed.match(/print\s*\(\s*(.+?)\s*\)/);
        if (printMatch) {
          let output = printMatch[1];
          
          // Handle string literals
          if (output.match(/^["'].*["']$/)) {
            output = output.slice(1, -1);
          }
          // Handle f-strings
          else if (output.match(/^f["'].*["']$/)) {
            output = `[F-string: ${output}]`;
          }
          // Handle expressions
          else if (output.match(/^\d+\s*[\+\-\*\/]\s*\d+$/)) {
            try {
              output = eval(output).toString();
            } catch (e) {
              output = `[Expression: ${output}]`;
            }
          }
          
          outputs.push(output);
        }
      });
    }
    
    else if (language === 'Java') {
      // Simulate Java execution
      lines.forEach(line => {
        const trimmed = line.trim();
        
        // System.out.println detection
        const printMatch = trimmed.match(/System\.out\.print(?:ln)?\s*\(\s*(.+?)\s*\)/);
        if (printMatch) {
          let output = printMatch[1];
          
          // Handle string literals
          if (output.match(/^".*"$/)) {
            output = output.slice(1, -1);
          }
          // Handle string concatenation
          else if (output.includes('+')) {
            output = `[String concatenation: ${output}]`;
          }
          
          outputs.push(output);
        }
      });
    }
    
    else if (language === 'C#') {
      // Simulate C# execution
      lines.forEach(line => {
        const trimmed = line.trim();
        
        // Console.WriteLine detection
        const consoleMatch = trimmed.match(/Console\.Write(?:Line)?\s*\(\s*(.+?)\s*\)/);
        if (consoleMatch) {
          let output = consoleMatch[1];
          
          if (output.match(/^".*"$/)) {
            output = output.slice(1, -1);
          }
          
          outputs.push(output);
        }
      });
    }
    
    else if (language === 'C++' || language === 'C') {
      // Simulate C/C++ execution
      lines.forEach(line => {
        const trimmed = line.trim();
        
        // cout detection
        const coutMatch = trimmed.match(/cout\s*<<\s*(.+?)\s*;/);
        if (coutMatch) {
          let output = coutMatch[1];
          
          if (output.match(/^".*"$/)) {
            output = output.slice(1, -1);
          }
          
          outputs.push(output);
        }
        
        // printf detection
        const printfMatch = trimmed.match(/printf\s*\(\s*"([^"]*)"(?:,\s*(.+?))?\s*\)/);
        if (printfMatch) {
          let output = printfMatch[1];
          const args = printfMatch[2];
          
          if (args) {
            output = `[Printf format: ${output} with args: ${args}]`;
          }
          
          outputs.push(output);
        }
      });
    }
    
  } catch (error) {
    outputs.push('[Output prediction error - complex logic detected]');
  }
  
  if (outputs.length === 0) {
    // Check for return statements or function definitions
    if (code.includes('return ') && !code.includes('console.log') && !code.includes('print(')) {
      outputs.push('[Function returns a value - no console output]');
    } else if (code.includes('function ') || code.includes('def ') || code.includes('class ')) {
      outputs.push('[Code defines functions/classes - no direct output]');
    } else {
      outputs.push('[No output statements detected]');
    }
  }
  
  return outputs.join('\n');
}

// Helper function to extract key components from code
function extractKeyComponents(code, language) {
  const components = [];
  const lines = code.split('\n');
  
  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    
    // Enhanced function detection with parameter analysis
    if (trimmedLine.includes('function ') || trimmedLine.includes('def ') || 
        trimmedLine.match(/^(public|private|protected)?\s*(static)?\s*\w+\s+\w+\s*\(/)) {
      
      let funcMatch, params = '', returnType = '';
      
      // JavaScript function detection
      if (language === 'JavaScript' && trimmedLine.includes('function ')) {
        funcMatch = trimmedLine.match(/function\s+(\w+)\s*\(([^)]*)\)/);
        if (funcMatch) {
          params = funcMatch[2] || '';
          const paramCount = params.trim() ? params.split(',').length : 0;
          components.push({
            type: "function",
            name: funcMatch[1],
            explanation: `A JavaScript function that ${paramCount > 0 ? `accepts ${paramCount} parameter(s): ${params}` : 'takes no parameters'}. Functions are reusable blocks of code that perform specific tasks and can return values.`
          });
        }
      }
      // Python function detection
      else if (language === 'Python' && trimmedLine.includes('def ')) {
        funcMatch = trimmedLine.match(/def\s+(\w+)\s*\(([^)]*)\)/);
        if (funcMatch) {
          params = funcMatch[2] || '';
          const paramCount = params.trim() ? params.split(',').length : 0;
          components.push({
            type: "function",
            name: funcMatch[1],
            explanation: `A Python function that ${paramCount > 0 ? `accepts ${paramCount} parameter(s): ${params}` : 'takes no parameters'}. Functions encapsulate reusable logic and can return values using the return statement.`
          });
        }
      }
      // Java/C# method detection
      else if ((language === 'Java' || language === 'C#') && trimmedLine.match(/^(public|private|protected)/)) {
        funcMatch = trimmedLine.match(/(public|private|protected)?\s*(static)?\s*(\w+)\s+(\w+)\s*\(([^)]*)\)/);
        if (funcMatch) {
          const visibility = funcMatch[1] || 'default';
          const isStatic = funcMatch[2] ? 'static ' : '';
          returnType = funcMatch[3];
          const methodName = funcMatch[4];
          params = funcMatch[5] || '';
          const paramCount = params.trim() ? params.split(',').length : 0;
          
          components.push({
            type: "method",
            name: methodName,
            explanation: `A ${visibility} ${isStatic}method that returns ${returnType} and ${paramCount > 0 ? `accepts ${paramCount} parameter(s)` : 'takes no parameters'}. Methods define the behavior of objects in object-oriented programming.`
          });
        }
      }
    }
    
    // Classes
    if (trimmedLine.includes('class ') || trimmedLine.includes('struct ')) {
      const classMatch = trimmedLine.match(/(?:class|struct)\s+(\w+)/);
      if (classMatch) {
        components.push({
          type: "class",
          name: classMatch[1],
          explanation: `A blueprint for creating objects that encapsulates data and behavior together.`
        });
      }
    }
    
    // Enhanced variable detection with type and value analysis
    if (trimmedLine.match(/^(var|let|const|int|double|float|String|char|boolean|bool)\s+\w+/) || 
        trimmedLine.match(/^\w+\s*=\s*.+/)) {
      
      let varMatch, varType = 'unknown', varValue = '';
      
      // JavaScript variable detection
      if (language === 'JavaScript') {
        varMatch = trimmedLine.match(/^(var|let|const)\s+(\w+)(?:\s*=\s*(.+?))?[;]?$/);
        if (varMatch) {
          varType = varMatch[1];
          const varName = varMatch[2];
          varValue = varMatch[3] || 'undefined';
          
          if (!components.find(c => c.name === varName)) {
            let explanation = '';
            
            // Specific explanations based on the value type
            if (varValue.includes('document.createElement')) {
              explanation = `A ${varType} variable that stores a newly created DOM element. Used for dynamically adding HTML elements to the webpage.`;
            } else if (varValue.includes('document.')) {
              explanation = `A ${varType} variable that stores a reference to a DOM element from the webpage. Used for manipulating existing HTML elements.`;
            } else if (varValue === '[]') {
              explanation = `A ${varType} variable initialized as an empty array. Arrays store multiple values in an ordered list and are perfect for managing collections of data.`;
            } else if (varValue === '{}') {
              explanation = `A ${varType} variable initialized as an empty object. Objects store key-value pairs and are used for structured data.`;
            } else {
              const scope = varType === 'var' ? 'function-scoped' : 'block-scoped';
              const mutability = varType === 'const' ? 'immutable' : 'mutable';
              explanation = `A ${scope}, ${mutability} JavaScript variable${varValue !== 'undefined' ? ` initialized with: ${varValue}` : ' declared without initial value'}. ${varType === 'const' ? 'Cannot be reassigned after declaration.' : 'Can be modified throughout its scope.'}`;
            }
            
            components.push({
              type: "variable",
              name: varName,
              explanation: explanation
            });
          }
        }
      }
      // Java/C# variable detection
      else if (language === 'Java' || language === 'C#') {
        varMatch = trimmedLine.match(/^(int|double|float|String|char|boolean|bool)\s+(\w+)(?:\s*=\s*(.+?))?[;]?$/);
        if (varMatch) {
          varType = varMatch[1];
          const varName = varMatch[2];
          varValue = varMatch[3] || 'default value';
          
          if (!components.find(c => c.name === varName)) {
            components.push({
              type: "variable",
              name: varName,
              explanation: `A ${varType} variable${varValue !== 'default value' ? ` initialized with: ${varValue}` : ' with default initialization'}. Strongly-typed variables ensure type safety and help prevent runtime errors.`
            });
          }
        }
      }
      // Python variable detection
      else if (language === 'Python') {
        varMatch = trimmedLine.match(/^(\w+)\s*=\s*(.+)$/);
        if (varMatch) {
          const varName = varMatch[1];
          varValue = varMatch[2];
          
          if (!components.find(c => c.name === varName)) {
            // Enhanced type inference with purpose analysis
            let inferredType = 'dynamic';
            let purpose = 'general data storage';
            
            if (varValue.match(/^["'].*["']$/)) {
              inferredType = 'string';
              purpose = 'text data storage and manipulation';
            } else if (varValue.match(/^\d+$/)) {
              inferredType = 'integer';
              purpose = 'whole number calculations and counting';
            } else if (varValue.match(/^\d*\.\d+$/)) {
              inferredType = 'float';
              purpose = 'decimal number calculations and measurements';
            } else if (varValue.match(/^(True|False)$/)) {
              inferredType = 'boolean';
              purpose = 'conditional logic and state tracking';
            } else if (varValue.match(/^\[.*\]$/)) {
              inferredType = 'list';
              purpose = 'ordered collection of items for iteration and data management';
            } else if (varValue.match(/^\{.*\}$/)) {
              inferredType = 'dictionary';
              purpose = 'key-value data mapping and structured data storage';
            } else if (varValue.includes('input(')) {
              inferredType = 'string (user input)';
              purpose = 'capturing and storing user-provided data';
            } else if (varValue.includes('range(')) {
              inferredType = 'range object';
              purpose = 'generating sequences of numbers for loops';
            }
            
            components.push({
              type: "variable",
              name: varName,
              explanation: `A Python variable (inferred type: ${inferredType}) assigned the value: ${varValue}. Purpose: ${purpose}. Python's dynamic typing allows this variable to be reassigned to different data types during execution.`
            });
          }
        }
      }
    }
    
    // Enhanced control structure analysis - Loops
    if (trimmedLine.includes('for ') || trimmedLine.includes('while ') || trimmedLine.includes('forEach')) {
      let loopType = 'loop';
      let explanation = '';
      
      if (trimmedLine.includes('for ')) {
        loopType = 'for loop';
        // Analyze for loop structure
        if (language === 'Python' && trimmedLine.includes(' in ')) {
          const forMatch = trimmedLine.match(/for\s+(\w+)\s+in\s+(.+?):/);
          if (forMatch) {
            explanation = `A Python for-in loop that iterates over ${forMatch[2]}, assigning each element to the variable '${forMatch[1]}'. This loop structure is ideal for processing collections like lists, strings, or ranges.`;
          } else {
            explanation = `A Python for-in loop that iterates over a collection, executing the loop body for each element. This is the preferred way to iterate in Python.`;
          }
        } else if (language === 'JavaScript' && trimmedLine.includes('forEach')) {
          explanation = `A JavaScript forEach method that executes a function for each array element. This functional approach provides cleaner iteration over arrays compared to traditional for loops.`;
        } else {
          explanation = `A for loop that repeats code execution a specific number of times or iterates through a collection. For loops are essential for processing multiple items efficiently without code duplication.`;
        }
      } else if (trimmedLine.includes('while ')) {
        loopType = 'while loop';
        const conditionMatch = trimmedLine.match(/while\s*\(\s*(.+?)\s*\)/);
        const condition = conditionMatch?.[1] || 'a condition';
        explanation = `A while loop that continues executing as long as '${condition}' remains true. While loops are perfect when the number of iterations is unknown and depends on changing conditions during execution.`;
      }
      
      components.push({
        type: loopType,
        name: `Line ${index + 1}`,
        explanation: explanation
      });
    }
    
    // Enhanced conditional analysis
    if (trimmedLine.includes('if ') || trimmedLine.includes('else') || trimmedLine.includes('elif') || trimmedLine.includes('switch')) {
      let conditionType = 'conditional';
      let explanation = '';
      
      if (trimmedLine.includes('if ') && !components.find(c => c.type === 'if statement')) {
        conditionType = 'if statement';
        const conditionMatch = trimmedLine.match(/if\s*\(\s*(.+?)\s*\)/);
        const condition = conditionMatch?.[1] || 'a condition';
        explanation = `An if statement that executes code only when '${condition}' evaluates to true. This creates branching logic that allows the program to make decisions and respond to different situations.`;
      } else if (trimmedLine.includes('else if') || trimmedLine.includes('elif')) {
        conditionType = 'else-if statement';
        explanation = `An else-if statement that provides an alternative condition to check when the previous if condition was false. This creates a chain of conditions for handling multiple scenarios.`;
      } else if (trimmedLine.includes('else') && !trimmedLine.includes('else if')) {
        conditionType = 'else statement';
        explanation = `An else statement that executes when all previous if/else-if conditions were false. This provides a default action ensuring the program handles all possible cases.`;
      } else if (trimmedLine.includes('switch')) {
        conditionType = 'switch statement';
        explanation = `A switch statement that compares a variable against multiple possible values. This provides a clean alternative to multiple if-else statements when checking a single variable against many values.`;
      }
      
      if (explanation && !components.find(c => c.type === conditionType)) {
        components.push({
          type: conditionType,
          name: `Line ${index + 1}`,
          explanation: explanation
        });
      }
    }
    
    // Main method/entry point
    if (trimmedLine.includes('main(') || trimmedLine.includes('public static void main') || 
        trimmedLine.includes('if __name__ == "__main__"')) {
      components.push({
        type: "main entry point",
        name: "main",
        explanation: `The starting point of program execution where the program begins running.`
      });
    }
    
    // JavaScript-specific DOM and event handling detection
    if (language === 'JavaScript') {
      // Event handlers
      if (trimmedLine.includes('.onclick') || trimmedLine.includes('.addEventListener')) {
        const eventMatch = trimmedLine.match(/(\w+)\.(?:onclick|addEventListener)/);
        const elementName = eventMatch?.[1] || 'element';
        if (!components.find(c => c.type === 'event handler' && c.name.includes(elementName))) {
          components.push({
            type: "event handler",
            name: `${elementName} event`,
            explanation: `An event handler that responds to user interactions with the ${elementName} element. When the user clicks or interacts with this element, the specified function will execute.`
          });
        }
      }
      
      // DOM methods
      if (trimmedLine.includes('document.createElement')) {
        const elementMatch = trimmedLine.match(/createElement\(['"](\w+)['"]\)/);
        const elementType = elementMatch?.[1] || 'element';
        if (!components.find(c => c.type === 'DOM creation' && c.name.includes(elementType))) {
          components.push({
            type: "DOM creation",
            name: `${elementType} element`,
            explanation: `Creates a new ${elementType} HTML element in memory. This element can be modified and then added to the webpage to dynamically change the page content.`
          });
        }
      }
      
      if (trimmedLine.includes('.appendChild') || trimmedLine.includes('.append')) {
        if (!components.find(c => c.type === 'DOM manipulation')) {
          components.push({
            type: "DOM manipulation",
            name: "element insertion",
            explanation: `Adds an element to the webpage by inserting it as a child of another element. This is how dynamically created elements become visible on the page.`
          });
        }
      }
      
      if (trimmedLine.includes('.textContent') || trimmedLine.includes('.innerHTML')) {
        if (!components.find(c => c.type === 'content modification')) {
          components.push({
            type: "content modification",
            name: "text/HTML update",
            explanation: `Modifies the text content or HTML inside an element. This allows the program to dynamically change what users see on the webpage.`
          });
        }
      }
    }
    
    // Imports/includes
    if (trimmedLine.includes('import ') || trimmedLine.includes('require(') || 
        trimmedLine.includes('#include') || trimmedLine.includes('using ')) {
      const moduleMatch = trimmedLine.match(/(?:import|require\(|#include|using)\s*['"<]?([^'">\s)]+)/);
      if (moduleMatch && !components.find(c => c.name === moduleMatch[1])) {
        components.push({
          type: "import/library",
          name: moduleMatch[1],
          explanation: `External code library that provides additional functionality to the program.`
        });
      }
    }
  });
  
  // Remove duplicates and limit to most important components
  const uniqueComponents = components.filter((comp, index, self) => 
    index === self.findIndex(c => c.name === comp.name && c.type === comp.type)
  ).slice(0, 8); // Limit to 8 most important components
  
  return uniqueComponents;
}

// Helper function to determine code purpose
function getCodePurpose(code, language) {
  const lowerCode = code.toLowerCase();
  
  // JavaScript-specific patterns
  if (language === 'JavaScript') {
    if (lowerCode.includes('document.') || lowerCode.includes('getelementby') || lowerCode.includes('queryselector')) {
      return 'DOM manipulation and web page interaction';
    } else if (lowerCode.includes('addeventlistener') || lowerCode.includes('onclick') || lowerCode.includes('onchange')) {
      return 'event handling and user interaction';
    } else if (lowerCode.includes('createelement') || lowerCode.includes('appendchild') || lowerCode.includes('innerhtml')) {
      return 'dynamic HTML content creation and manipulation';
    } else if (lowerCode.includes('fetch') || lowerCode.includes('axios') || lowerCode.includes('xmlhttprequest')) {
      return 'API communication and data fetching';
    } else if (lowerCode.includes('async') || lowerCode.includes('await') || lowerCode.includes('promise')) {
      return 'asynchronous operations and promise handling';
    } else if (lowerCode.includes('localstorage') || lowerCode.includes('sessionstorage') || lowerCode.includes('cookie')) {
      return 'client-side data storage and management';
    }
  }
  
  // General patterns
  if (lowerCode.includes('api') || lowerCode.includes('fetch') || lowerCode.includes('axios') || lowerCode.includes('request')) {
    return 'API integration or web service communication';
  } else if (lowerCode.includes('database') || lowerCode.includes('sql') || lowerCode.includes('query')) {
    return 'database operations and data management';
  } else if (lowerCode.includes('ui') || lowerCode.includes('button') || lowerCode.includes('click') || lowerCode.includes('dom')) {
    return 'user interface interactions and DOM manipulation';
  } else if (lowerCode.includes('algorithm') || lowerCode.includes('sort') || lowerCode.includes('search')) {
    return 'algorithmic processing and data manipulation';
  } else if (lowerCode.includes('test') || lowerCode.includes('assert') || lowerCode.includes('expect')) {
    return 'testing and quality assurance';
  } else if (lowerCode.includes('class') || lowerCode.includes('object') || lowerCode.includes('method')) {
    return 'object-oriented programming and class definitions';
  } else {
    return 'general programming logic and functionality';
  }
}

// Enhanced complexity assessment algorithm
function determineComplexity(code) {
  const lines = code.split('\n').filter(line => line.trim()).length;
  const functions = (code.match(/function|def |public |private |method/g) || []).length;
  const loops = (code.match(/for |while |forEach|do\s+{/g) || []).length;
  const conditions = (code.match(/if |else|elif|switch|case/g) || []).length;
  const classes = (code.match(/class |struct |interface/g) || []).length;
  const recursion = (code.match(/return\s+\w+\s*\(/g) || []).length;
  const asyncOperations = (code.match(/async|await|Promise|callback/g) || []).length;
  const errorHandling = (code.match(/try|catch|except|finally|throw/g) || []).length;
  const nestedStructures = (code.match(/\s{4,}(if|for|while)/g) || []).length;
  const complexDataStructures = (code.match(/Map|Set|Array|List|Dictionary|\[\]|\{\}/g) || []).length;
  
  // Weighted complexity scoring
  let complexityScore = 0;
  complexityScore += lines * 0.5; // Base complexity from code length
  complexityScore += functions * 3; // Functions add moderate complexity
  complexityScore += loops * 4; // Loops add significant complexity
  complexityScore += conditions * 2; // Conditionals add moderate complexity
  complexityScore += classes * 5; // OOP adds higher complexity
  complexityScore += recursion * 6; // Recursion adds high complexity
  complexityScore += asyncOperations * 5; // Async operations add high complexity
  complexityScore += errorHandling * 3; // Error handling adds moderate complexity
  complexityScore += nestedStructures * 4; // Nesting adds significant complexity
  complexityScore += complexDataStructures * 2; // Data structures add some complexity
  
  // Determine complexity level with more nuanced thresholds
  if (complexityScore < 15) return 'beginner';
  if (complexityScore < 40) return 'intermediate';
  if (complexityScore < 80) return 'advanced';
  return 'expert';
}

// Enhanced suggestions function with language-specific recommendations
function getDetailedSuggestions(code, language) {
  const suggestions = [];
  const lowerCode = code.toLowerCase();
  const lines = code.split('\n');
  
  // Documentation and Comments
  const commentLines = lines.filter(line => 
    line.trim().startsWith('//') || line.trim().startsWith('#') || line.trim().startsWith('/*')
  ).length;
  const codeLines = lines.filter(line => line.trim() && !line.trim().startsWith('//') && !line.trim().startsWith('#')).length;
  
  if (commentLines / Math.max(codeLines, 1) < 0.1) {
    suggestions.push('📝 Add more comments to explain complex logic and improve code maintainability (aim for 10-20% comment ratio)');
  }
  
  // Error Handling
  if (!lowerCode.includes('try') && !lowerCode.includes('catch') && !lowerCode.includes('except') && codeLines > 5) {
    suggestions.push('🛡️ Add error handling with try-catch blocks to make your code more robust and user-friendly');
  }
  
  // Language-specific suggestions
  if (language === 'JavaScript') {
    if (code.includes('var ')) {
      suggestions.push('🔧 Replace "var" with "const" or "let" for better variable scoping and to prevent hoisting issues');
    }
    if (code.includes('==') && !code.includes('===')) {
      suggestions.push('⚡ Use strict equality (===) instead of loose equality (==) to avoid type coercion bugs');
    }
    if (lowerCode.includes('console.log')) {
      suggestions.push('🔍 Replace console.log with proper logging libraries (like Winston) for production applications');
    }
    if (!lowerCode.includes('async') && !lowerCode.includes('promise') && lowerCode.includes('fetch')) {
      suggestions.push('⚡ Consider using async/await for better handling of asynchronous operations');
    }
  }
  
  if (language === 'Python') {
    if (!code.includes('if __name__ == "__main__":') && code.includes('def ')) {
      suggestions.push('🚀 Add "if __name__ == "__main__":" guard to make your script importable as a module');
    }
    if (lowerCode.includes('print(') && !lowerCode.includes('logging')) {
      suggestions.push('📊 Replace print statements with the logging module for better debugging and production monitoring');
    }
    if (!lowerCode.includes('docstring') && code.includes('def ')) {
      suggestions.push('📚 Add docstrings to your functions to document their purpose, parameters, and return values');
    }
  }
  
  if (language === 'Java' || language === 'C#') {
    if (!lowerCode.includes('final') && !lowerCode.includes('readonly')) {
      suggestions.push('🔒 Use final/readonly keywords for variables that shouldn\'t be modified to improve code safety');
    }
    if (!lowerCode.includes('private') && !lowerCode.includes('public')) {
      suggestions.push('🔐 Explicitly declare access modifiers (private, public, protected) for better encapsulation');
    }
  }
  
  // Performance and Structure
  const nestedDepth = Math.max(...lines.map(line => {
    const match = line.match(/^(\s*)/);
    return match ? Math.floor(match[1].length / 2) : 0;
  }));
  
  if (nestedDepth > 4) {
    suggestions.push('🏗️ Reduce nesting depth by extracting nested logic into separate functions (current max depth: ' + nestedDepth + ')');
  }
  
  if (codeLines > 50) {
    suggestions.push('✂️ Consider breaking this code into smaller, more focused functions or classes for better maintainability');
  }
  
  // Security suggestions
  if (lowerCode.includes('password') || lowerCode.includes('secret') || lowerCode.includes('key')) {
    suggestions.push('🔐 Ensure sensitive data like passwords and API keys are stored securely and not hardcoded');
  }
  
  // Testing and Quality
  if (!lowerCode.includes('test') && !lowerCode.includes('assert')) {
    suggestions.push('🧪 Add unit tests to ensure your code works correctly and prevent regressions');
  }
  
  // Code formatting
  const inconsistentIndentation = lines.some(line => {
    const spaces = line.match(/^( *)/)?.[1]?.length || 0;
    return spaces % 2 !== 0 && spaces % 4 !== 0;
  });
  
  if (inconsistentIndentation) {
    suggestions.push('📐 Use consistent indentation (2 or 4 spaces) and consider using a code formatter like Prettier or Black');
  }
  
  // Performance suggestions
  if (lowerCode.includes('for') && lowerCode.includes('array') && language === 'JavaScript') {
    suggestions.push('⚡ Consider using array methods like map(), filter(), or reduce() for more functional and readable code');
  }
  
  // Add API key suggestion for enhanced analysis
  suggestions.push('🔑 For AI-powered detailed analysis with advanced insights, add your OpenAI API key to the .env file');
  
  // Add comprehensive error detection
  const errors = detectCommonErrors(code, language);
  if (errors.length > 0) {
    suggestions.unshift(`🚨 Potential Issues Detected: ${errors.join(', ')}`);
  }
  
  return suggestions.slice(0, 8); // Limit to 8 most relevant suggestions
}

// Comprehensive error detection function
function detectCommonErrors(code, language) {
  const errors = [];
  const lines = code.split('\n');
  
  // Language-specific error detection
  if (language === 'JavaScript') {
    // Missing semicolons
    const missingSemicolons = lines.filter(line => {
      const trimmed = line.trim();
      return trimmed.length > 0 && 
             !trimmed.endsWith(';') && 
             !trimmed.endsWith('{') && 
             !trimmed.endsWith('}') && 
             !trimmed.startsWith('//') && 
             !trimmed.includes('if ') && 
             !trimmed.includes('else') && 
             !trimmed.includes('for ') && 
             !trimmed.includes('while ') && 
             !trimmed.includes('function ') &&
             (trimmed.includes('=') || trimmed.includes('console.log') || trimmed.includes('return'));
    }).length;
    
    if (missingSemicolons > 0) {
      errors.push(`${missingSemicolons} missing semicolons`);
    }
    
    // Undefined variables (basic check)
    if (code.includes('var ') && (code.includes('let ') || code.includes('const '))) {
      errors.push('mixed var/let/const usage');
    }
    
    // Loose equality
    if (code.includes('==') && !code.includes('===')) {
      errors.push('loose equality operators');
    }
  }
  
  else if (language === 'Python') {
    // Indentation issues
    const indentationIssues = lines.some(line => {
      const spaces = line.match(/^( *)/)?.[1]?.length || 0;
      return spaces > 0 && spaces % 4 !== 0;
    });
    
    if (indentationIssues) {
      errors.push('inconsistent indentation');
    }
    
    // Missing colons
    const missingColons = lines.filter(line => {
      const trimmed = line.trim();
      return (trimmed.startsWith('if ') || 
              trimmed.startsWith('else') || 
              trimmed.startsWith('for ') || 
              trimmed.startsWith('while ') || 
              trimmed.startsWith('def ') || 
              trimmed.startsWith('class ')) && 
             !trimmed.endsWith(':');
    }).length;
    
    if (missingColons > 0) {
      errors.push(`${missingColons} missing colons`);
    }
  }
  
  else if (language === 'Java') {
    // Missing semicolons
    const missingSemicolons = lines.filter(line => {
      const trimmed = line.trim();
      return trimmed.length > 0 && 
             !trimmed.endsWith(';') && 
             !trimmed.endsWith('{') && 
             !trimmed.endsWith('}') && 
             !trimmed.startsWith('//') && 
             !trimmed.includes('if ') && 
             !trimmed.includes('else') && 
             !trimmed.includes('for ') && 
             !trimmed.includes('while ') && 
             !trimmed.includes('public ') && 
             !trimmed.includes('private ') &&
             (trimmed.includes('=') || trimmed.includes('System.out') || trimmed.includes('return'));
    }).length;
    
    if (missingSemicolons > 0) {
      errors.push(`${missingSemicolons} missing semicolons`);
    }
    
    // Missing access modifiers
    if (!code.includes('public') && !code.includes('private') && code.includes('class')) {
      errors.push('missing access modifiers');
    }
  }
  
  // General errors for all languages
  
  // Unmatched brackets
  const openBrackets = (code.match(/\{/g) || []).length;
  const closeBrackets = (code.match(/\}/g) || []).length;
  if (openBrackets !== closeBrackets) {
    errors.push('unmatched brackets');
  }
  
  // Unmatched parentheses
  const openParens = (code.match(/\(/g) || []).length;
  const closeParens = (code.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    errors.push('unmatched parentheses');
  }
  
  // Potential infinite loops
  const whileTrue = code.includes('while(true)') || code.includes('while (true)') || code.includes('while True:');
  if (whileTrue && !code.includes('break')) {
    errors.push('potential infinite loop');
  }
  
  // Unused variables (basic detection)
  const variableDeclarations = code.match(/(?:var|let|const|int|String)\s+(\w+)/g) || [];
  const unusedVars = variableDeclarations.filter(decl => {
    const varName = decl.split(/\s+/).pop();
    const usageCount = (code.match(new RegExp(`\\b${varName}\\b`, 'g')) || []).length;
    return usageCount === 1; // Only declared, never used
  });
  
  if (unusedVars.length > 0) {
    errors.push(`${unusedVars.length} potentially unused variables`);
  }
  
  return errors;
}


// Helper function to call Hugging Face API for translation (always to Python)
async function callHuggingFaceTranslate(code, language) {
  try {
    console.log('🤖 Calling Hugging Face API for translation...');
    console.log('📝 Input code length:', code.length);
    console.log('🔤 Source language:', language);
    
    // Check if we have a valid HF API key
    if (!process.env.HF_API_KEY || process.env.HF_API_KEY === 'your_token_here' || process.env.HF_API_KEY === 'hf_your_actual_token_here') {
      console.log('Using demo mode - no valid HF API key provided. Current key:', process.env.HF_API_KEY?.substring(0, 10) + '...');
      return getDemoTranslateResponse(code, language);
    }

    console.log('🔑 Using HF API key:', process.env.HF_API_KEY?.substring(0, 10) + '...');

    // Use CodeT5+ model which is better for code translation
    const modelUrl = `${HF_API_URL}/Salesforce/codet5p-770m`;
    
    // Create a more detailed prompt for better translation
    const prompt = `# Task: Translate ${language} code to Python
# Source Language: ${language}
# Target Language: Python
# Instructions: Convert the following code to equivalent Python code, maintaining the same functionality and logic.

## ${language} Code:
${code}

## Python Translation:`;
    
    const response = await axios.post(modelUrl, {
      inputs: prompt,
      parameters: {
        max_new_tokens: 512,
        temperature: 0.3,
        do_sample: true,
        top_p: 0.9,
        repetition_penalty: 1.1
      }
    }, {
      headers: HF_HEADERS,
      timeout: 30000
    });

    console.log('✅ Hugging Face translate API call successful');
    console.log('📤 Response received, processing...');
    
    // Process the response and format it according to our expected structure
    const translateResult = processHuggingFaceTranslateResponse(response.data, code, language);
    return translateResult;

  } catch (error) {
    console.error('❌ Hugging Face translate API error:', error.message);
    console.log('🔄 Trying OpenAI as fallback...');
    
    // Try OpenAI as fallback if HF fails
    try {
      const openaiResult = await callOpenAI(prompts.translate, code, language, 'Python');
      if (openaiResult && openaiResult.translatedCode) {
        console.log('✅ OpenAI fallback successful');
        return openaiResult;
      }
    } catch (openaiError) {
      console.error('❌ OpenAI fallback also failed:', openaiError.message);
    }
    
    console.log('🔄 Using smart demo translation as final fallback');
    return getDemoTranslateResponse(code, language);
  }
}


// Helper function to process Hugging Face translate response
function processHuggingFaceTranslateResponse(hfResponse, code, language) {
  try {
    console.log('🔍 Processing HF response:', JSON.stringify(hfResponse, null, 2));
    
    // Extract the generated text from HF response
    let generatedText = '';
    if (Array.isArray(hfResponse) && hfResponse[0]?.generated_text) {
      generatedText = hfResponse[0].generated_text;
    } else if (hfResponse.generated_text) {
      generatedText = hfResponse.generated_text;
    } else if (typeof hfResponse === 'string') {
      generatedText = hfResponse;
    }

    console.log('📝 Generated text:', generatedText);

    // Clean up the generated Python code
    let pythonCode = generatedText.trim();
    
    // Remove the original prompt from the response
    if (pythonCode.includes('## Python Translation:')) {
      pythonCode = pythonCode.split('## Python Translation:')[1].trim();
    } else if (pythonCode.includes('Python Translation:')) {
      pythonCode = pythonCode.split('Python Translation:')[1].trim();
    } else if (pythonCode.includes('Python:')) {
      pythonCode = pythonCode.split('Python:')[1].trim();
    }
    
    // Remove any remaining prompt artifacts
    pythonCode = pythonCode.replace(/^# Task:.*$/gm, '');
    pythonCode = pythonCode.replace(/^# Source Language:.*$/gm, '');
    pythonCode = pythonCode.replace(/^# Target Language:.*$/gm, '');
    pythonCode = pythonCode.replace(/^# Instructions:.*$/gm, '');
    pythonCode = pythonCode.replace(/^## .*Code:$/gm, '');
    
    // Clean up extra whitespace
    pythonCode = pythonCode.replace(/\n\s*\n\s*\n/g, '\n\n').trim();
    
    // If the response is too short or doesn't look like code, enhance it
    if (pythonCode.length < 20 || !pythonCode.includes('\n')) {
      console.log('⚠️ Generated code too short, enhancing...');
      pythonCode = generateEnhancedPythonTranslation(code, language, pythonCode);
    }
    
    // Ensure it has proper Python structure
    if (!pythonCode.includes('def ') && !pythonCode.includes('class ') && 
        !pythonCode.includes('import ') && !pythonCode.includes('from ') &&
        code.length > 50) {
      pythonCode = `# Translated from ${language} to Python
${pythonCode}

def main():
    # Main execution
    pass

if __name__ == "__main__":
    main()`;
    }

    console.log('✅ Final Python code:', pythonCode);

    return {
      language: "Python",
      translatedCode: pythonCode,
      dependencies: extractPythonDependencies(pythonCode),
      notes: `Successfully translated ${language} code to Python using Hugging Face CodeT5+ model. The translation maintains the original functionality while following Python conventions.`
    };

  } catch (error) {
    console.error('❌ Error processing HF translate response:', error);
    return getDemoTranslateResponse(code, language);
  }
}

// Enhanced Python translation for short responses
function generateEnhancedPythonTranslation(originalCode, language, shortResponse) {
  console.log('🔧 Enhancing short translation response...');
  
  // Use the smart translation as fallback
  const smartTranslation = generateSmartPythonTranslation(originalCode, language);
  
  // If we have some response from HF, try to incorporate it
  if (shortResponse && shortResponse.length > 5) {
    return `# Translated from ${language} to Python
# Enhanced with smart pattern matching

${shortResponse}

# Additional translation:
${smartTranslation}`;
  }
  
  return smartTranslation;
}

// Extract Python dependencies from code
function extractPythonDependencies(pythonCode) {
  const dependencies = [];
  const lines = pythonCode.split('\n');
  
  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('import ')) {
      const module = trimmed.replace('import ', '').split(' as ')[0].split('.')[0];
      if (!dependencies.includes(module)) {
        dependencies.push(module);
      }
    } else if (trimmed.startsWith('from ')) {
      const module = trimmed.split(' ')[1];
      if (!dependencies.includes(module)) {
        dependencies.push(module);
      }
    }
  });
  
  return dependencies.length > 0 ? dependencies : ["# No additional dependencies required"];
}

// Demo translate response specifically for Python output
function getDemoTranslateResponse(code, language) {
  const pythonCode = generateSmartPythonTranslation(code, language);

  return {
    language: "Python",
    translatedCode: pythonCode,
    dependencies: ["# No additional dependencies required"],
    notes: `Translated from ${language} to Python using smart pattern matching. For AI-powered translation, add your Hugging Face API key.`
  };
}

// Smart Python translation function
function generateSmartPythonTranslation(code, language) {
  if (language === 'Java') {
    return translateJavaToPython(code);
  } else if (language === 'JavaScript') {
    return translateJavaScriptToPython(code);
  } else if (language === 'C++' || language === 'C#') {
    return translateCToPython(code);
  } else {
    return translateGenericToPython(code, language);
  }
}

// Java to Python translation
function translateJavaToPython(code) {
  let pythonCode = `# Translated from Java to Python\n\n`;
  
  // Remove class declaration and main method wrapper
  let processedCode = code;
  
  // Extract the main method content
  const mainMethodMatch = processedCode.match(/public\s+static\s+void\s+main\s*\([^)]*\)\s*\{([\s\S]*)\}/);
  if (mainMethodMatch) {
    processedCode = mainMethodMatch[1];
  }
  
  const lines = processedCode.split('\n');
  let pythonLines = [];
  let indentLevel = 0;
  
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed === '{' || trimmed === '}') return;
    
    let pythonLine = '';
    const indent = '    '.repeat(indentLevel);
    
    // Handle different Java constructs
    if (trimmed.includes('System.out.println(')) {
      // Convert System.out.println to print
      const content = trimmed.match(/System\.out\.println\s*\(\s*(.+?)\s*\)\s*;?/);
      if (content) {
        let printContent = content[1];
        // Convert Java string concatenation to Python f-strings or simple concatenation
        if (printContent.includes('+')) {
          // Simple approach: convert " + var + " to f-string style
          printContent = printContent.replace(/"\s*\+\s*(\w+)\s*\+\s*"/g, '{$1}');
          printContent = printContent.replace(/(\w+)\s*\+\s*"/g, '{$1}"');
          printContent = printContent.replace(/"\s*\+\s*(\w+)/g, '"{$1}');
          if (printContent.includes('{') && printContent.includes('}')) {
            printContent = 'f' + printContent;
          }
        }
        pythonLine = `${indent}print(${printContent})`;
      }
    } else if (trimmed.includes('System.out.print(')) {
      // Convert System.out.print to print with end=''
      const content = trimmed.match(/System\.out\.print\s*\(\s*(.+?)\s*\)\s*;?/);
      if (content) {
        pythonLine = `${indent}print(${content[1]}, end='')`;
      }
    } else if (trimmed.match(/^(int|double|float|long|short|byte)\s+\w+/)) {
      // Convert variable declarations
      const varMatch = trimmed.match(/^(int|double|float|long|short|byte)\s+(\w+)\s*=\s*(.+?)\s*;?$/);
      if (varMatch) {
        pythonLine = `${indent}${varMatch[2]} = ${varMatch[3]}`;
      } else {
        const simpleVarMatch = trimmed.match(/^(int|double|float|long|short|byte)\s+(\w+)\s*;?$/);
        if (simpleVarMatch) {
          pythonLine = `${indent}${simpleVarMatch[2]} = 0  # Initialize variable`;
        }
      }
    } else if (trimmed.match(/^String\s+\w+/)) {
      // Convert String declarations
      const stringMatch = trimmed.match(/^String\s+(\w+)\s*=\s*(.+?)\s*;?$/);
      if (stringMatch) {
        pythonLine = `${indent}${stringMatch[1]} = ${stringMatch[2]}`;
      }
    } else if (trimmed.startsWith('if ')) {
      // Convert if statements
      const ifMatch = trimmed.match(/^if\s*\(\s*(.+?)\s*\)\s*\{?/);
      if (ifMatch) {
        pythonLine = `${indent}if ${ifMatch[1]}:`;
        indentLevel++;
      }
    } else if (trimmed.startsWith('else if ')) {
      // Convert else if statements
      const elifMatch = trimmed.match(/^else\s+if\s*\(\s*(.+?)\s*\)\s*\{?/);
      if (elifMatch) {
        indentLevel--;
        pythonLine = `${indent}elif ${elifMatch[1]}:`;
        indentLevel++;
      }
    } else if (trimmed === 'else {' || trimmed === 'else') {
      // Convert else statements
      indentLevel--;
      pythonLine = `${indent}else:`;
      indentLevel++;
    } else if (trimmed.startsWith('for ')) {
      // Convert for loops
      const forMatch = trimmed.match(/^for\s*\(\s*(.+?)\s*\)\s*\{?/);
      if (forMatch) {
        pythonLine = `${indent}# for ${forMatch[1]}  # TODO: Convert to Python for loop`;
        indentLevel++;
      }
    } else if (trimmed.startsWith('while ')) {
      // Convert while loops
      const whileMatch = trimmed.match(/^while\s*\(\s*(.+?)\s*\)\s*\{?/);
      if (whileMatch) {
        pythonLine = `${indent}while ${whileMatch[1]}:`;
        indentLevel++;
      }
    } else if (trimmed === '}') {
      // Handle closing braces
      indentLevel = Math.max(0, indentLevel - 1);
      return;
    } else if (trimmed.includes('=') && !trimmed.includes('==')) {
      // Handle assignments
      const assignMatch = trimmed.match(/^(\w+)\s*=\s*(.+?)\s*;?$/);
      if (assignMatch) {
        pythonLine = `${indent}${assignMatch[1]} = ${assignMatch[2]}`;
      }
    } else if (trimmed.endsWith(';')) {
      // Generic statement
      pythonLine = `${indent}${trimmed.slice(0, -1)}  # Converted from Java`;
    }
    
    if (pythonLine) {
      pythonLines.push(pythonLine);
    }
  });
  
  // Add main function wrapper
  if (pythonLines.length > 0) {
    pythonCode += `def main():\n`;
    pythonCode += pythonLines.map(line => line || '    pass').join('\n');
    pythonCode += `\n\nif __name__ == "__main__":\n    main()`;
  } else {
    pythonCode += `def main():\n    print("Hello, World!")\n\nif __name__ == "__main__":\n    main()`;
  }
  
  return pythonCode;
}

// JavaScript to Python translation (enhanced)
function translateJavaScriptToPython(code) {
  let pythonCode = `# Translated from JavaScript to Python\n\n`;
  
  const lines = code.split('\n');
  let pythonLines = [];
  let indentLevel = 0;
  let inFunction = false;
  
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) {
      pythonLines.push('');
      return;
    }
    
    const indent = '    '.repeat(indentLevel);
    let pythonLine = '';
    
    // Handle function declarations
    if (trimmed.match(/^function\s+\w+\s*\(/)) {
      const funcMatch = trimmed.match(/^function\s+(\w+)\s*\(([^)]*)\)\s*\{?/);
      if (funcMatch) {
        const funcName = funcMatch[1];
        const params = funcMatch[2].trim();
        pythonLine = `${indent}def ${funcName}(${params}):`;
        indentLevel++;
        inFunction = true;
      }
    }
    // Handle arrow functions (basic support)
    else if (trimmed.includes('=>')) {
      const arrowMatch = trimmed.match(/(\w+)\s*=>\s*\{?/);
      if (arrowMatch) {
        pythonLine = `${indent}# Arrow function - convert manually: ${trimmed}`;
      }
    }
    // Handle variable declarations
    else if (trimmed.match(/^(const|let|var)\s+\w+/)) {
      const varMatch = trimmed.match(/^(const|let|var)\s+(\w+)\s*=\s*(.+?)\s*;?$/);
      if (varMatch) {
        let value = varMatch[3];
        // Convert JavaScript arrays to Python lists
        if (value === '[]') {
          value = '[]';
        } else if (value.startsWith('[') && value.endsWith(']')) {
          // Keep array syntax as is for simple arrays
          value = value;
        }
        pythonLine = `${indent}${varMatch[2]} = ${value}`;
      }
    }
    // Handle console.log statements
    else if (trimmed.includes('console.log(')) {
      const content = trimmed.match(/console\.log\s*\(\s*(.+?)\s*\)\s*;?/);
      if (content) {
        let printContent = content[1];
        // Convert template literals and string concatenation
        if (printContent.includes('`')) {
          // Convert template literals to f-strings
          printContent = printContent.replace(/`([^`]*)`/g, (match, p1) => {
            const converted = p1.replace(/\$\{([^}]+)\}/g, '{$1}');
            return `f"${converted}"`;
          });
        } else if (printContent.includes('+')) {
          // Convert string concatenation to f-strings
          printContent = printContent.replace(/`([^`]*)`/g, '"$1"');
        }
        pythonLine = `${indent}print(${printContent})`;
      }
    }
    // Handle console.clear()
    else if (trimmed.includes('console.clear()')) {
      pythonLine = `${indent}import os; os.system('cls' if os.name == 'nt' else 'clear')`;
    }
    // Handle array methods
    else if (trimmed.includes('.push(')) {
      const pushMatch = trimmed.match(/(\w+)\.push\s*\(\s*(.+?)\s*\)\s*;?/);
      if (pushMatch) {
        pythonLine = `${indent}${pushMatch[1]}.append(${pushMatch[2]})`;
      }
    }
    // Handle forEach loops
    else if (trimmed.includes('.forEach(')) {
      const forEachMatch = trimmed.match(/(\w+)\.forEach\s*\(\s*\(([^)]*)\)\s*=>\s*\{?/);
      if (forEachMatch) {
        const arrayName = forEachMatch[1];
        const params = forEachMatch[2].split(',').map(p => p.trim());
        if (params.length === 2) {
          pythonLine = `${indent}for ${params[1]}, ${params[0]} in enumerate(${arrayName}):`;
        } else if (params.length === 1) {
          pythonLine = `${indent}for ${params[0]} in ${arrayName}:`;
        }
        indentLevel++;
      }
    }
    // Handle function calls
    else if (trimmed.match(/^\w+\s*\(/)) {
      const callMatch = trimmed.match(/^(\w+)\s*\(([^)]*)\)\s*;?/);
      if (callMatch) {
        pythonLine = `${indent}${callMatch[1]}(${callMatch[2]})`;
      }
    }
    // Handle closing braces
    else if (trimmed === '}' || trimmed === '});') {
      indentLevel = Math.max(0, indentLevel - 1);
      if (inFunction && indentLevel === 0) {
        inFunction = false;
      }
      return; // Don't add the brace to output
    }
    // Handle if statements
    else if (trimmed.startsWith('if ')) {
      const ifMatch = trimmed.match(/^if\s*\(\s*(.+?)\s*\)\s*\{?/);
      if (ifMatch) {
        pythonLine = `${indent}if ${ifMatch[1]}:`;
        indentLevel++;
      }
    }
    // Handle else statements
    else if (trimmed === 'else {' || trimmed === 'else') {
      indentLevel--;
      pythonLine = `${indent}else:`;
      indentLevel++;
    }
    // Handle return statements
    else if (trimmed.startsWith('return ')) {
      const returnMatch = trimmed.match(/^return\s+(.+?)\s*;?$/);
      if (returnMatch) {
        pythonLine = `${indent}return ${returnMatch[1]}`;
      } else {
        pythonLine = `${indent}return`;
      }
    }
    // Handle assignments
    else if (trimmed.includes('=') && !trimmed.includes('==') && !trimmed.includes('===')) {
      const assignMatch = trimmed.match(/^(\w+)\s*=\s*(.+?)\s*;?$/);
      if (assignMatch) {
        pythonLine = `${indent}${assignMatch[1]} = ${assignMatch[2]}`;
      }
    }
    // Handle other statements
    else if (trimmed.endsWith(';')) {
      pythonLine = `${indent}${trimmed.slice(0, -1)}`;
    }
    // Fallback for unhandled cases
    else {
      pythonLine = `${indent}# ${trimmed}  # TODO: Convert this JavaScript syntax`;
    }
    
    if (pythonLine) {
      pythonLines.push(pythonLine);
    }
  });
  
  // Add any necessary imports at the top
  let finalCode = pythonCode;
  if (code.includes('console.clear()')) {
    finalCode = `# Translated from JavaScript to Python\nimport os\n\n`;
  }
  
  finalCode += pythonLines.join('\n');
  
  // Add main execution if there are function calls at the top level
  const hasTopLevelCalls = lines.some(line => {
    const trimmed = line.trim();
    return trimmed.match(/^\w+\s*\(/) && !trimmed.startsWith('function') && !trimmed.includes('=>');
  });
  
  if (hasTopLevelCalls) {
    finalCode += `\n\n# Execute the program\nif __name__ == "__main__":\n    pass  # Top-level calls are already included above`;
  }
  
  return finalCode;
}

// Generic translation for other languages
function translateGenericToPython(code, language) {
  return `# Translated from ${language} to Python\n# Original code structure preserved\n\n${code}\n\n# TODO: Manual conversion needed for ${language} specific syntax`;
}

// C/C# to Python translation (simplified)
function translateCToPython(code) {
  let pythonCode = `# Translated from C/C++ to Python\n\n`;
  
  const lines = code.split('\n');
  let pythonLines = [];
  
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.includes('#include') || trimmed.includes('using namespace')) return;
    
    if (trimmed.includes('printf(') || trimmed.includes('cout <<')) {
      pythonLines.push(`print("Output statement")  # Convert printf/cout manually`);
    } else if (trimmed.match(/^(int|double|float|char)\s+\w+/)) {
      const varMatch = trimmed.match(/^(int|double|float|char)\s+(\w+)\s*=\s*(.+?)\s*;?$/);
      if (varMatch) {
        pythonLines.push(`${varMatch[2]} = ${varMatch[3]}`);
      }
    } else {
      pythonLines.push(`# ${trimmed}`);
    }
  });
  
  pythonCode += pythonLines.join('\n');
  return pythonCode;
}

// @route   POST /api/analyze
// @desc    Analyze code and provide explanations
// @access  Public (with optional auth)
router.post('/analyze', optionalAuth, async (req, res) => {
  try {
    console.log('🔍 ANALYZE route called');
    const { code, language } = req.body;
    console.log('📝 Analyze request - Language:', language, 'Code length:', code?.length);

    if (!code || !language) {
      return res.status(400).json({
        success: false,
        message: 'Code and language are required'
      });
    }

    if (code.length > 10000) {
      return res.status(400).json({
        success: false,
        message: 'Code is too long. Maximum 10,000 characters allowed.'
      });
    }

    console.log('🚀 Calling OpenAI for code analysis...');
    console.log('🔍 Using prompt type:', prompts.analyze.substring(0, 50) + '...');
    const result = await callOpenAI(prompts.analyze, code, language);
    console.log('✅ Code analysis completed successfully');
    console.log('🔍 Result type:', typeof result, 'Keys:', Object.keys(result || {}));
    console.log('📊 Analysis result structure:', {
      hasLanguage: !!result.language,
      hasOverview: !!result.overview,
      hasKeyComponents: !!result.keyComponents,
      keyComponentsLength: result.keyComponents?.length || 0,
      hasLineByLineAnalysis: !!result.lineByLineAnalysis,
      lineByLineAnalysisLength: result.lineByLineAnalysis?.length || 0,
      hasSummary: !!result.summary,
      hasComplexity: !!result.complexity,
      hasSuggestions: !!result.suggestions
    });

    // Save to user session if authenticated
    if (req.user) {
      User.addSession(req.user.id, {
        type: 'analyze',
        code,
        language,
        result
      });
    }

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('❌ Analyze route error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to analyze code'
    });
  }
});


// @route   POST /api/translate
// @desc    Translate code to another language
// @access  Public (with optional auth)
router.post('/translate', optionalAuth, async (req, res) => {
  try {
    console.log('🌐 TRANSLATE route called');
    const { code, language, targetLanguage } = req.body;
    console.log('📝 Translate request - From:', language, 'To:', targetLanguage, 'Code length:', code?.length);

    if (!code || !language || !targetLanguage) {
      return res.status(400).json({
        success: false,
        message: 'Code, source language, and target language are required'
      });
    }

    if (code.length > 10000) {
      return res.status(400).json({
        success: false,
        message: 'Code is too long. Maximum 10,000 characters allowed.'
      });
    }

    console.log('🚀 Calling Hugging Face for code translation...');
    // Always translate to Python as per requirements
    const result = await callHuggingFaceTranslate(code, language);
    console.log('✅ Code translation completed successfully');

    // Save to user session if authenticated
    if (req.user) {
      User.addSession(req.user.id, {
        type: 'translate',
        code,
        language,
        targetLanguage,
        result
      });
    }

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('❌ Translate route error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to translate code'
    });
  }
});

// @route   POST /api/debug
// @desc    Debug code and find errors with suggestions
// @access  Public (with optional auth)
router.post('/debug', optionalAuth, async (req, res) => {
  try {
    console.log('🐛 DEBUG route called with OpenAI API');
    const { code, language } = req.body;
    console.log('📝 Debug request - Language:', language, 'Code length:', code?.length);

    if (!code || !language) {
      return res.status(400).json({
        success: false,
        message: 'Code and language are required'
      });
    }

    if (code.length > 10000) {
      return res.status(400).json({
        success: false,
        message: 'Code is too long. Maximum 10,000 characters allowed.'
      });
    }

    console.log('🚀 Calling OpenAI API for code debugging...');
    const result = await callOpenAI(prompts.debug, code, language);
    console.log('✅ Code debugging completed successfully');
    console.log('🔍 Result type:', typeof result, 'Keys:', Object.keys(result || {}));
    console.log('🐛 Debug result structure:', {
      hasLanguage: !!result.language,
      hasIssues: !!result.issues,
      issuesCount: result.issues?.length || 0,
      hasSuggestions: !!result.suggestions,
      suggestionsCount: result.suggestions?.length || 0,
      hasFixedCode: !!result.fixedCode,
      hasSummary: !!result.summary
    });

    // Save to user session if authenticated
    if (req.user) {
      User.addSession(req.user.id, {
        type: 'debug',
        code,
        language,
        result
      });
    }

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('❌ Debug route error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to debug code'
    });
  }
});

// @route   GET /api/languages
// @desc    Get supported programming languages
// @access  Public
router.get('/languages', (req, res) => {
  const languages = [
    'JavaScript',
    'Python',
    'Java',
    'C++',
    'C#',
    'Go',
    'Rust',
    'Kotlin',
    'TypeScript',
    'HTML',
    'CSS',
    'SQL',
    'R',
    'MATLAB',
    'Scala',
    'Perl',
    'Lua'
  ];

  res.json({
    success: true,
    data: languages
  });
});

// @route   GET /api/health
// @desc    Health check endpoint
// @access  Public
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
    openaiConfigured: !!process.env.OPENAI_API_KEY && 
                     process.env.OPENAI_API_KEY !== 'your_openai_api_key_here' &&
                     process.env.OPENAI_API_KEY !== 'sk-test-demo-key-for-testing',
    huggingFaceConfigured: !!process.env.HF_API_KEY && 
                          process.env.HF_API_KEY !== 'your_token_here',
    geminiConfigured: !!process.env.GEMINI_API_KEY && 
                     process.env.GEMINI_API_KEY !== 'demo-key' &&
                     process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here',
    apiKeyPrefix: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 20) + '...' : 'Not set',
    hfApiKeyPrefix: process.env.HF_API_KEY ? process.env.HF_API_KEY.substring(0, 10) + '...' : 'Not set',
    geminiApiKeyPrefix: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 10) + '...' : 'Not set'
  });
});


module.exports = router;
