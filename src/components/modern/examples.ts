export const defaultInput='A cat is sitting on the sofa.';
export function decisionPayload(input=defaultInput,image?:string){return {model:'valen-2b',input:image?[{role:'user',content:[{type:'input_text',text:input},{type:'input_image',image_url:image}]}]:input,questions:[{name:'q0',type:'choice',instructions:'Which animal is present?',choices:[{value:'cat',description:'A cat'},{value:'dog',description:'A dog'}]}],temperature:1.0};}
export function requestCode(payload=decisionPayload(),language='python',filename='image.jpg',protocol='decisions') {
 if(protocol==='systemone') return systemOneRequestCode(payload,language,filename);
 const image=Array.isArray(payload.input)?payload.input[0]?.content.find(c=>c.type==='input_image')?.image_url:undefined;
 const safePayload=JSON.parse(JSON.stringify(payload));
 if(image) safePayload.input[0].content.find((c:{type:string})=>c.type==='input_image').image_url='__IMAGE_URL__';
 const value=JSON.stringify(safePayload,null,2).replace('"__IMAGE_URL__"','image_url');
 const imageSetup=image?`import base64\nimport mimetypes\nfrom pathlib import Path\n\nimage_path = Path(${JSON.stringify(filename)})\nmime_type = mimetypes.guess_type(image_path.name)[0]\nimage_url = f"data:{mime_type};base64," + base64.b64encode(\n    image_path.read_bytes()\n).decode("ascii")\n\n`:'';
 if(language==='bash'&&image) return `# Run in the folder containing your selected image.\npython3 - <<'PY' > request.json\nimport json, sys\n${imageSetup}payload = ${value}\njson.dump(payload, sys.stdout)\nPY\n\ncurl --request POST \\\n  https://api.valen-team.workers.dev/v1/decisions \\\n  --header 'Content-Type: application/json' \\\n  --header 'Origin: https://valen-team.github.io' \\\n  --data @request.json`;
 if(language==='bash')return `curl --request POST \\\n  https://api.valen-team.workers.dev/v1/decisions \\\n  --header 'Content-Type: application/json' \\\n  --header 'Origin: https://valen-team.github.io' \\\n  --data '${value.replaceAll("'", "'\\''")}'`;
 return `import requests\n${image?'\n'+imageSetup:'\n'}response = requests.post(\n    "https://api.valen-team.workers.dev/v1/decisions",\n    headers={"Origin": "https://valen-team.github.io"},\n    json=${value.split('\n').map((line,i)=>i?'    '+line:line).join('\n')},\n    timeout=120,\n)\nresponse.raise_for_status()\nbody = response.json()\nanswer = body["answers"][0]\nprint(answer["choice"], answer["confidence"])\nfor entry in answer["probabilities"]:\n    print(entry["value"], entry["probability"])\nprint("Model ID:", body.get("model_id"))`;
}
function systemOneRequestCode(payload=decisionPayload(), language='python', filename='image.jpg') {
  const source = JSON.parse(JSON.stringify(payload));
  const q = source.questions[0];
  const image = Array.isArray(source.input) ? source.input[0].content.find((c: {type: string}) => c.type === 'input_image')?.image_url as string | undefined : undefined;
  const text = Array.isArray(source.input) ? source.input[0].content.filter((c: {type: string}) => c.type === 'input_text').map((c: {text: string}) => c.text).join('') : source.input;
  const reference = 'valen-example-photo';
  const question: Record<string, unknown> = {type: q.type === 'predicate' ? 'noul' : q.type, instructions: q.instructions};
  if(q.type === 'choice') question.criteria = Object.fromEntries(q.choices.map((c: {value: string; description: string}) => [c.value, c.description]));
  if(q.type === 'score') question.criteria = q.levels.map((l: {description: string}) => l.description);
  const body: Record<string, unknown> = {model: source.model, state: text + (image ? '\n' + reference : ''), questions: {[q.name]: question}, temperature: source.temperature};
  if(image) body.assets = {[reference]: {type: 'image', format: '__IMAGE_FORMAT__', data_base64: '__IMAGE_DATA__'}};
  const value = JSON.stringify(body, null, 2).replace('"__IMAGE_DATA__"', 'image_b64').replace('"__IMAGE_FORMAT__"', 'image_format');
  const imageSetup = image ? `import base64\nimport mimetypes\nfrom pathlib import Path\n\nimage_path = Path(${JSON.stringify(filename)})\nmime_type = mimetypes.guess_type(image_path.name)[0]\nimage_format = mime_type.split("/", 1)[1]\nimage_b64 = base64.b64encode(image_path.read_bytes()).decode("ascii")\n\n` : '';
  const headers: Record<string, string> = {Origin: 'https://valen-team.github.io'};
  if(image) headers['TypeSafe-Danger-Zone-Images'] = 'true';
  const url = 'https://api.valen-team.workers.dev/v1/systemone';
  const curl = `curl --request POST '${url}' --header 'Content-Type: application/json' --header 'Origin: https://valen-team.github.io'${image ? " --header 'TypeSafe-Danger-Zone-Images: true'" : ''}`;
  if(language === 'bash' && image) return `python3 - <<'PY' > request.json\nimport json, sys\n${imageSetup}payload = ${value}\njson.dump(payload, sys.stdout)\nPY\n\n${curl} --data @request.json`;
  if(language === 'bash') return `${curl} --data '${value.replaceAll("'", "'\\''")}'`;
  return `import requests\n\n${imageSetup}response = requests.post(\n    "${url}",\n    headers=${JSON.stringify(headers)},\n    json=${value.split('\n').map((line, i) => i ? '    ' + line : line).join('\n')},\n    timeout=120,\n)\nresponse.raise_for_status()\nbody = response.json()\nanswer = body["answers"][${JSON.stringify(q.name)}]\nprint(answer)\nprint("Model ID:", body.get("model_id"))`;
}
