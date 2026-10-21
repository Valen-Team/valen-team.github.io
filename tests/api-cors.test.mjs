import test from 'node:test';
import assert from 'node:assert/strict';
import dashboard from '../api-proxy/worker-dashboard.mjs';
import wrangler from '../api-proxy/worker.mjs';

for(const [name,worker] of [['dashboard',dashboard],['wrangler',wrangler]]){
  test(`${name}: website and exact Valen API Space pass preflight`,async()=>{
    for(const origin of ['https://valen-team.github.io','https://valen-team-valen-api.static.hf.space']){
      const response=await worker.fetch(new Request('https://api.valen-team.workers.dev/v1/decisions',{method:'OPTIONS',headers:{Origin:origin}}),{});
      assert.equal(response.status,204);assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin);
      assert.equal(response.headers.get('Vary'),'Origin');
    }
  });
  test(`${name}: unrelated Spaces and absent Origin remain denied`,async()=>{
    for(const origin of ['https://unrelated.static.hf.space','https://valen-team-valen-api.static.hf.space.evil.example','']){
      const response=await worker.fetch(new Request('https://api.valen-team.workers.dev/v1/decisions',{method:'OPTIONS',headers:origin?{Origin:origin}:{}}),{});
      assert.equal(response.status,403);assert.equal(response.headers.get('Access-Control-Allow-Origin'),null);
    }
  });
}
