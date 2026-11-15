const fs = require('fs'); 
const code = fs.readFileSync('c:/Users/ivanf/Documents/7mo/Proyecto del login original y funcional/frontend/src/app/components/admin/admin-products/admin-products.component.ts', 'utf8'); 
let depth = 0; 
let minDepth = 0; 
let inString = false; 
let strChar = ''; 
let inComment = false; 
let inMultiComment = false; 
let lastBracePos = 0;

for(let i=0; i<code.length; i++) { 
    const c = code[i]; 
    
    if (!inString && !inComment && !inMultiComment) { 
        if (c === '{') {
            depth++; 
        } else if (c === '}') { 
            depth--; 
            minDepth = Math.min(minDepth, depth); 
            if (depth === 0) {
                lastBracePos = i;
            }
        } else if (c === '\'' || c === '\"' || c === '\`') { 
            inString = true; strChar = c; 
        } else if (c === '/' && code[i+1] === '/') { 
            inComment = true; i++; 
        } else if (c === '/' && code[i+1] === '*') { 
            inMultiComment = true; i++; 
        } 
    } else if (inString && c === strChar && code[i-1] !== '\\') { 
        inString = false; 
    } else if (inComment && c === '\n') { 
        inComment = false; 
    } else if (inMultiComment && c === '*' && code[i+1] === '/') { 
        inMultiComment = false; i++; 
    } 
} 
console.log({depth, minDepth});
console.log('Last brace line:', code.substring(0, lastBracePos).split('\n').length);
