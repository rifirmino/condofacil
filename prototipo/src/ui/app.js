import { html, render } from '../vendor.js';
import { fmtDia, isoDia } from '../datas.js';

render(html`<p>CondoFácil · ${fmtDia(isoDia(new Date()))}</p>`, document.getElementById('app'));
