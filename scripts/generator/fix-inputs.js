const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'create-frontend.js');
let code = fs.readFileSync(filePath, 'utf-8');

// Pattern: raw input div lines in FeatureCreatePage and FeatureEditPage
const rawInputBlock = [
  '          <div key={f} style={{marginBottom:12}}>',
  "            <label style={{display:'block',fontSize:13,fontWeight:700,color:'var(--dry-text-secondary)',marginBottom:4,textTransform:'uppercase'}}>{f}</label>",
  "            <input className='form-input' value={form[f]||''} onChange={e => setForm({...form,[f]:e.target.value})} />",
  '          </div>',
].join('\n    ');

const dryInputLine = "          <DryInput key={f} label={f} value={form[f]||''} onChange={(val) => setForm({...form,[f]:val})} placeholder={f} />";

const countBefore = (code.match(/<input className='form-input'/g) || []).length;
code = code.split(rawInputBlock).join(dryInputLine);
const countAfter = (code.match(/<input className='form-input'/g) || []).length;

fs.writeFileSync(filePath, code, 'utf-8');
console.log('Replacements: ' + (countBefore - countAfter) + ' inputs replaced');
console.log('Remaining raw inputs: ' + countAfter);
