/* Tama o Mali? Three quick true-or-false questions a day on the Quests tab: two about the season, one general.
   Each correct answer is +5 XP (BD.today().xpQuiz). Everyone gets the same questions on the same day.
   Facts follow DOH first-aid advice and PAGASA's heat index and rainfall warning guides. */
window.BD = window.BD || {};
(function (BD) {
  const I = BD.icon, esc = BD.esc, XP = 5;
  // [id, season ('heat' | 'rain' | 'any'), statement, true?, why]
  const Q = [
    ['h1', 'heat', 'Heat stroke is an emergency. Call 911 right away.', true, 'Heat stroke can kill. Call 911, then cool the person with water and fanning while you wait.'],
    ['h2', 'heat', 'Give cold drinks to someone with heat stroke even if they are confused or unconscious.', false, 'Never give drinks to someone who is confused or unconscious: they could choke. Cool their body instead.'],
    ['h3', 'heat', 'On hot days, drink water even if you are not thirsty.', true, 'Thirst comes late. Drink a glass of water every hour when the heat index is high.'],
    ['h4', 'heat', 'Soft drinks are better than water on a very hot day.', false, 'Water is best. Sugary drinks and alcohol do not keep you hydrated.'],
    ['h5', 'heat', 'The heat index is how hot it feels, counting the humidity.', true, 'Humid air makes sweating less cooling, so 33°C can feel like 41°C.'],
    ['h6', 'heat', 'Early morning is the hottest time of day to be outside.', false, 'The hottest hours are usually 10 AM to 4 PM. Do outdoor work early or late.'],
    ['h7', 'heat', 'Never leave a child or a pet in a parked car, even for a few minutes.', true, 'A closed car heats up very fast and can kill in minutes.'],
    ['h8', 'heat', 'Heavy sweating means your body is fine, so keep working in the sun.', false, 'Heavy sweating, dizziness and cramps are signs of heat exhaustion. Rest in the shade and drink water.'],
    ['h9', 'heat', 'Seniors, babies and sick people feel the heat first.', true, 'Their bodies cool down more slowly. Check on them during hot afternoons.'],
    ['h10', 'heat', 'Wet towels and fanning help cool someone with heat exhaustion.', true, 'Move them to the shade, loosen their clothes, wet the skin and fan them.'],
    ['h11', 'heat', 'Loose, light-colored clothes help you stay cooler.', true, 'Light colors reflect sunlight and loose clothes let sweat dry.'],
    ['h12', 'heat', 'A Caution heat index (27–32°C) is safe for a whole day of hard work in the sun.', false, 'Fatigue is possible with long exposure. Take breaks in the shade and drink water.'],
    ['r1', 'rain', 'Ankle-deep floodwater is safe to walk through.', false, 'Floodwater can hide open drains and carry leptospirosis. Avoid it whenever you can.'],
    ['r2', 'rain', 'You can get leptospirosis from wading in floodwater, especially with a wound.', true, 'The germ enters through cuts and wet skin. See a doctor if you get a fever after wading.'],
    ['r3', 'rain', 'A Yellow rainfall warning means you must evacuate right away.', false, 'Yellow means flooding is possible: monitor and prepare. Red means evacuate if you live in a flood-prone area.'],
    ['r4', 'rain', 'A Red rainfall warning means serious flooding is expected.', true, 'Evacuate now if you live in a flood-prone or low-lying area.'],
    ['r5', 'rain', 'Dengue mosquitoes breed in clean standing water, like in old tires and flower pots.', true, 'Empty, scrub and cover containers. This is part of the DOH 4S.'],
    ['r6', 'rain', 'Take aspirin for a fever during the rainy season.', false, 'Avoid aspirin and ibuprofen until dengue is ruled out. See a doctor for a fever.'],
    ['r7', 'rain', 'It is fine to drive through a flooded road if the car in front made it.', false, 'Moving water only knee-deep can sweep a car away. Turn around.'],
    ['r8', 'rain', 'Clearing canals and drains near your house helps stop street flooding.', true, 'Blocked drains are the first to overflow. Clear them before heavy rain.'],
    ['r9', 'rain', 'Electrical appliances are safe to use while standing in floodwater.', false, 'Water and electricity can kill. Turn off the main switch if water is rising.'],
    ['r10', 'rain', 'Charge your phone and power bank before a storm.', true, 'Power can go out for hours. A charged phone keeps you reachable.'],
    ['r11', 'rain', 'Landslides are more likely in the uplands after days of heavy rain.', true, 'Watch for cracks, tilting trees and muddy streams in Marilog, Paquibato and Calinan.'],
    ['a1', 'any', '911 is the emergency hotline in Davao City.', true, 'Central 911 Davao answers police, fire and medical emergencies.'],
    ['a2', 'any', 'Put something in the mouth of a person having a seizure so they do not bite their tongue.', false, 'Never put anything in their mouth. Move hard things away, turn them on their side and time the seizure.'],
    ['a3', 'any', 'Wash a small wound with soap and clean water, then cover it.', true, 'Clean wounds heal faster and are less likely to get infected.'],
    ['a4', 'any', 'A go-bag should have water, food, medicine, a flashlight and copies of IDs.', true, 'Keep it ready by the door so you can leave in minutes.'],
    ['a5', 'any', 'Know your nearest evacuation center before an emergency.', true, 'Find it on the Mapa tab and walk the route once with your family.'],
    ['a6', 'any', 'It is fine to wait for the water to rise before you pack your go-bag.', false, 'Pack early. When the water rises, there may be no time and no power.']
  ];
  const byId = id => Q.find(q => q[0] === id);

  // Same three questions for everyone on a given day (seeded by the date).
  function seeded(key) {
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
    return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  }
  function pickFor(day, season) {
    const r = seeded(day + season), take = (list, n) => list.map(q => [r(), q[0]]).sort((a, b) => a[0] - b[0]).slice(0, n).map(x => x[1]);
    return take(Q.filter(q => q[1] === season), 2).concat(take(Q.filter(q => q[1] === 'any'), 1));
  }
  function quiz() {
    const t = BD.today();
    if (!t.quiz || t.quiz.season !== BD.state.season && !Object.keys(t.quiz.ans || {}).length) t.quiz = { season: BD.state.season, ids: pickFor(BD.todayKey(), BD.state.season), ans: {} };
    return t.quiz;
  }
  const right = (z, id) => z.ans[id] === byId(id)[3];

  BD.quizCard = function () {
    const z = quiz(), n = Object.keys(z.ans).length, ok = z.ids.filter(id => id in z.ans && right(z, id)).length;
    const step = BD.ui.quizStep;
    let body;
    if (step == null && n === 0) {
      body = '<p class="fam-p">3 quick questions about heat, floods and first aid. <b>+' + XP + ' XP for each right answer.</b></p>' +
        '<button class="btn btn-primary btn-block" data-action="quizStart">' + I('zap', 18) + 'Start</button>';
    } else if (step == null && n >= z.ids.length) {
      body = '<p class="quiz-score"><b class="num">' + ok + '/' + z.ids.length + '</b> correct · +' + ok * XP + ' XP</p>' +
        '<p class="fine">' + I('clock', 13) + 'New questions tomorrow. ' + (ok === z.ids.length ? 'Perfect score. Galing!' : 'Keep learning, bantay!') + '</p>' +
        '<button class="link-btn" data-action="quizReview">See answers</button>';
    } else {
      const i = step == null ? n : step, id = z.ids[i], q = byId(id), answered = id in z.ans;
      body = '<div class="quiz-prog" aria-hidden="true">' + z.ids.map((x, k) => '<i class="' + (x in z.ans ? (right(z, x) ? 'ok' : 'no') : k === i ? 'cur' : '') + '"></i>').join('') + '</div>' +
        '<p class="quiz-n">Question ' + (i + 1) + ' of ' + z.ids.length + '</p>' +
        '<p class="quiz-q">' + esc(q[2]) + '</p>' +
        (answered
          ? '<div class="quiz-fb ' + (right(z, id) ? 'ok' : 'no') + '" role="status">' + I(right(z, id) ? 'check' : 'x', 18) +
            '<div><b>' + (right(z, id) ? 'Correct!' : 'Not quite.') + ' ' + (q[3] ? 'The answer is Tama.' : 'The answer is Mali.') + '</b><span>' + esc(q[4]) + '</span></div></div>' +
            '<button class="btn btn-soft btn-block" data-action="quizNext">' + (i + 1 < z.ids.length ? 'Next question' : 'See my score') + '</button>'
          : '<div class="quiz-btns"><button class="btn quiz-t" data-action="quizAnswer" data-v="1">' + I('check', 18) + 'Tama</button>' +
            '<button class="btn quiz-f" data-action="quizAnswer" data-v="0">' + I('x', 18) + 'Mali</button></div>');
    }
    return '<div class="card quiz" id="quiz"><div class="card-head"><h3>' + I('star', 18) + 'Tama o Mali?</h3><span class="fine">Daily quiz</span></div>' + body + '</div>';
  };

  Object.assign(BD.actions = BD.actions || {}, {
    quizStart() { BD.ui.quizStep = 0; BD.render(); },
    quizAnswer(el) {
      const z = quiz(), i = BD.ui.quizStep == null ? Object.keys(z.ans).length : BD.ui.quizStep, id = z.ids[i];
      if (id in z.ans) return;
      const v = el.dataset.v === '1', good = v === byId(id)[3];
      BD.commit(() => { z.ans[id] = v; const t = BD.today(); t.quiz = z; if (good) t.xpQuiz = (t.xpQuiz || 0) + XP; }, el);
      if (!good) BD.vibrate(40);
    },
    quizNext() { const i = (BD.ui.quizStep || 0) + 1; BD.ui.quizStep = i < quiz().ids.length ? i : null; BD.render(); },
    quizReview() { BD.ui.quizStep = 0; BD.render(); }   // steps through the answered questions with their reasons
  });
  BD.QUIZ = Q;   // for tests and translation tools
  BD.quizPick = pickFor;
})(window.BD);
