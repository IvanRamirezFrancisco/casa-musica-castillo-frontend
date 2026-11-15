const fs = require('fs'); 
const code = fs.readFileSync('c:/Users/ivanf/Documents/7mo/Proyecto del login original y funcional/frontend/src/app/components/admin/admin-products/admin-products.component.ts', 'utf8'); 
let depth = 0; 
let inString = false; 
let strChar = ''; 
let inComment = false; 
let inMultiComment = false; 

for(let i=0; i<code.length; i++) { 
    const c = code[i]; 
    if (!inString && !inComment && !inMultiComment) { 
        if (c === '{') {
            depth++; 
        } else if (c === '}') { 
            depth--; 
            if (depth === 0) { 
                console.log('Depth is 0 at line:', code.substring(0, i).split('\n').length); 
            } else if (depth < 0) {
                console.log('Depth is negative at line:', code.substring(0, i).split('\n').length);
                break;
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
