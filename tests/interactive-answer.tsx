import React from 'react';
import { createRoot } from 'react-dom/client';
import { InteractiveAnswer } from '../src/learning/agent/InteractiveAnswer';
import '../src/learning/learning.css';
const ui = {
  html: '<meta http-equiv="refresh" content="0;url=https://example.com"><h2>Explore a linear relationship</h2><p>Illustrative example: y = 2x.</p><label for="value">Input x</label><input id="value" type="range" min="0" max="10" value="3"><p>Output y: <output id="result">6</output></p><svg viewBox="0 0 300 120" role="img" aria-label="Output as a bar"><rect id="bar" x="0" y="30" width="90" height="40" fill="#287456"/></svg>',
  css: 'input{display:block;width:100%;margin:20px 0}output{font-weight:bold}h2{font-size:22px}',
  js: 'document.querySelector("#value").addEventListener("input",event=>{document.querySelector("#result").value=Number(event.target.value)*2;document.querySelector("#bar").setAttribute("width",Number(event.target.value)*30)})',
};
createRoot(document.getElementById('root')!).render(<main className="learn" style={{ maxWidth: 800, margin: '40px auto', padding: 20 }}><h1>Interactive learning answer</h1><InteractiveAnswer ui={ui} title="Linear relationship"/><p>The cited text explanation stays available below the visual.</p><InteractiveAnswer ui={{html:'<p>Broken visual</p>',css:'',js:'throw new Error("fixture");'}} title="Runtime error"/></main>);
