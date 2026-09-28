/** Native modal supplies focus containment, Escape dismissal and focus return. */
export function createHelp(onOpen:()=>void,onClose:()=>void){
  const dialog=document.createElement('dialog');
  dialog.id='help';dialog.className='help-dialog';
  dialog.setAttribute('aria-labelledby','help-title');
  dialog.setAttribute('aria-describedby','help-summary');
  dialog.innerHTML=`
    <header class="help-heading"><div><p>HOW TO PLAY</p><h2 id="help-title" tabindex="-1">Make it home.</h2></div><button type="button" id="help-close" aria-label="Close help">Close <span aria-hidden="true">×</span></button></header>
    <div class="help-body">
      <p id="help-summary">You’re a small, hungry slug in a very big garden. Eat, stay alive and bring your feast back to the overturned pot. The game waits while you read.</p>
      <ol class="help-plan">
        <li><strong>Find dinner.</strong> Start with three meals: lettuce, lilies or a mixture. Hold <kbd>E</kbd> nearby and stay still. Lettuce is quick and restores more moisture; lilies earn more points. With hatchlings, follow the HUD’s family provisions target instead — up to seven meals.</li>
        <li><strong>Stay damp. Stay hidden.</strong> Visit puddles to restore moisture and health. Hold <kbd>Ctrl</kbd> or <kbd>C</kbd> to sneak among plants in the beds. Watch the gardener and cross the mower’s path behind it.</li>
        <li><strong>Bring the feast home.</strong> At 100%, return to the green home marker. You can risk more food for extra points. Call roaming young with <kbd>Q</kbd> or <strong>Call young</strong>, then wait by the pot until every survivor is inside.</li>
      </ol>
      <details open><summary>Controls</summary>
        <dl class="help-controls">
          <dt><kbd>WASD</kbd> / arrows</dt><dd>Crawl relative to the camera</dd>
          <dt>Drag the view</dt><dd>Look around</dd>
          <dt>Hold <kbd>E</kbd></dt><dd>Eat or meet a companion while still</dd>
          <dt><kbd>Ctrl</kbd> / <kbd>C</kbd></dt><dd>Sneak in the garden beds</dd>
          <dt>Hold <kbd>Shift</kbd></dt><dd>Slide faster; uses moisture</dd>
          <dt><kbd>Q</kbd></dt><dd>Gather your young, even before you’re full</dd>
          <dt><kbd>V</kbd></dt><dd>Switch ground view / overview</dd>
          <dt><kbd>Esc</kbd></dt><dd>Pause / resume; close this help</dd>
          <dt><kbd>H</kbd> / <kbd>?</kbd></dt><dd>Open this guide</dd>
        </dl>
        <p>On touchscreens, use the directional buttons, Sneak and the Eat / Meet / Nest button. Drag to look around. The Call young button gathers your family.</p>
      </details>
      <details><summary>Read the garden: water and hazards</summary>
        <dl class="help-hazards">
          <dt>Puddles · blue map dots</dt><dd>Restore moisture and gradually heal. They also wash off poison. Rain restores moisture, but does not wash poison off.</dd>
          <dt>Salt · white grains, red map dots</dt><dd>Causes rapid damage. Crawl away immediately.</dd>
          <dt>Poison · blue pellets, cyan map dots</dt><dd>Damage continues after you leave. Get to a puddle to wash it off.</dd>
          <dt>Beer traps · gold map dots</dt><dd>The scent pulls you toward the bowl. Crawl away as soon as you feel dizzy; Shift helps. Staying at the rim is fatal.</dd>
          <dt>The gardener</dt><dd>His suspicion rises when he sees you. Hide among plants or behind pots and large rocks. When he raises his spade, move away before it lands. He can investigate eaten lily stems.</dd>
          <dt>The mower · orange map dot</dt><dd>Patrols the back-right lawn. Contact is fatal, and short grass provides no cover. Watch its route and cross behind it.</dd>
        </dl>
        <p>Direction warnings point relative to your camera, including threats behind you. Salt, puddles and the companion get new locations when you load the garden; they stay put through retries. Beer and poison change between raids. The silver trail always leads to the companion.</p>
      </details>
      <details><summary>A companion, eggs and your young</summary>
        <p>Family life is optional. Follow the silver trail and hold <kbd>E</kbd> beside the companion for two seconds. Then return home with enough food and at least <strong>45% moisture</strong>. Press <kbd>E</kbd> to lay six eggs and shelter; laying uses 20 moisture. You can choose <strong>Shelter without eggs</strong> instead.</p>
        <p>Eggs hatch after two successful night transitions. Hatchlings need extra provisions, but stay sheltered for their first night. After another successful night, up to six older young come out and explore.</p>
        <p>Call with <kbd>Q</kbd> or <strong>Call young</strong> whenever you need to gather them. Once the food target is complete, they follow automatically. Stay close to protect them and lead them back to the pot.</p>
        <p><strong>A youngster in danger has six seconds.</strong> It freezes when the gardener threatens it away from you. Call it away or reach it before the warning runs out. If the gardener is still close when time expires, the youngster dies. Family losses are saved, including across retries.</p>
      </details>
      <details><summary>Three nights, scores and saving</summary>
        <p>Survive three raids: a clear evening, a rainy night and a dry evening. Each homecoming advances the campaign. Death or Start over repeats the current night. The gardener adds poison near the bed where you ate most.</p>
        <p>Lilies earn 100 food points; lettuce earns 40. Extra food adds a risk bonus, and remaining health adds points. Tonight’s challenge is optional; its bonus is awarded only if you get home. Failing a challenge does not end the raid.</p>
        <p>The campaign, nest, family and personal best are saved in this browser when storage is available. Reloading restarts an unfinished raid and generates a fresh garden layout. Starting a new three-night run keeps your family.</p>
      </details>
    </div>
    <form method="dialog" class="help-footer"><span>The garden can wait.</span><button class="primary" value="done">Got it</button></form>`;
  document.body.append(dialog);
  const close=()=>{
    if(!dialog.open)return;
    dialog.close();onClose();
  };
  dialog.querySelector<HTMLButtonElement>('#help-close')!.onclick=close;
  dialog.querySelector('form')!.addEventListener('submit',event=>{event.preventDefault();close();});
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  return {
    get isOpen(){return dialog.open;},
    open(){
      if(dialog.open)return;
      onOpen();dialog.showModal();dialog.scrollTop=0;
      dialog.querySelector<HTMLElement>('#help-title')!.focus({preventScroll:true});
    },
  };
}
