import {esc,ico} from './common.js';

export function createUpdateUi(notify) {
// Android updateverzoeken lopen alleen via de kleine native bridge.
const androidUpdateAvailable = Boolean(window.SchattepatatjesUpdater);
let updaterInfo = {status:'idle', version:'0.5.1'};
function updatePanel(){
  if(!androidUpdateAvailable) return '';
  const u=updaterInfo;
  const messages={idle:'Controleer wanneer je wilt of er een nieuwe Android-versie klaarstaat.',checking:'Even kijken of er iets nieuws is…',current:'Je hebt de nieuwste versie.',downloading:`Nieuwe versie ophalen… ${u.progress||0}%`,installing:'Android opent de installatie. Bevestig de update op je telefoon.',permission:'Sta Schattepatatjes toe om een update te installeren; kom daarna terug naar de app.',error:u.message||'Controleren lukte niet. Probeer het later opnieuw.'};
  const text=u.status==='available'?`Versie ${esc(u.version)} is beschikbaar. ${esc(u.notes||'')}`:messages[u.status]||messages.idle;
  return `<h3 class="form-heading" style="margin-top:24px">App bijwerken</h3><div class="setup-card" id="updater-card">
    <div class="status-row">${ico('info','sm')} Schattepatatjes voor Android · versie ${esc(window.SchattepatatjesUpdater?.appVersion?.()||'0.5.1')}</div>
    <p id="updater-message" aria-live="polite">${text}</p>
    ${u.status==='available'?`<button class="gloss-btn" data-action="install-app-update">Download en installeer ${esc(u.version)}</button>`:''}
    ${u.status==='downloading'?`<progress style="width:100%" max="100" value="${Number(u.progress)||0}"></progress>`:''}
    <button class="gloss-btn secondary small" data-action="check-app-update" ${u.status==='checking'||u.status==='downloading'?'disabled':''}>${ico('cloud','sm')} Controleren op updates</button>
    <p class="fineprint" style="margin-top:11px">Je gegevens blijven staan. Android vraagt altijd zelf om toestemming voor de installatie.</p>
  </div>`;
}
window.schattepatatjesUpdateEvent=function(raw){
  try{
    const next=JSON.parse(raw);
    const previous=updaterInfo.status;
    updaterInfo=next;
    const card=document.querySelector('#updater-card');
    if(card){const tmp=document.createElement('div');tmp.innerHTML=updatePanel();card.replaceWith(tmp.querySelector('#updater-card'));}
    if(next.status==='available' && previous!=='available' && !card) notify(`Schattepatatjes ${next.version} is beschikbaar bij instellingen.`);
    if(next.status==='error' && previous==='downloading') notify(next.message||'Bijwerken is niet gelukt.');
  }catch(e){console.warn('Updatebericht kon niet worden gelezen',e);}
};


return {androidUpdateAvailable, updatePanel};
}
