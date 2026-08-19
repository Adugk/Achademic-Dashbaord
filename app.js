/* =========================================================
   Scholar OS — app.js
   Vanilla JS, localStorage-backed. No build step required.
   ========================================================= */

(function(){
  "use strict";

  /* ---------------- State ---------------- */

  const STORAGE_KEY = "scholarOS.v1";

  const DAY_ORDER = ["Mon","Tue","Wed","Thu","Fri"];
  const DAY_TO_JSDAY = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 };

  function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

  function defaultState(){
    return {
      courses: COURSES,
      term: TERM_INFO,
      assignments: [],
      tasks: [],
      goals: [],
      habits: [],
      notes: [],
      decks: [],
      pomodoro: { sessionsLog: [] }, // array of ISO date strings, one per completed focus session
    };
  }

  let state = loadState();

  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return defaultState();
      const parsed = JSON.parse(raw);
      // always refresh course list from courses.js in case it changed
      parsed.courses = COURSES;
      parsed.term = TERM_INFO;
      return Object.assign(defaultState(), parsed);
    }catch(e){
      console.error("Failed to load state, starting fresh.", e);
      return defaultState();
    }
  }

  function saveState(){
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }catch(e){
      console.error("Failed to save state", e);
      toast("Couldn't save — storage may be full.");
    }
  }

  /* ---------------- Helpers ---------------- */

  function courseByCode(code){
    return state.courses.find(c => c.code === code);
  }

  function toast(msg, ms=2200){
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(()=> el.classList.remove("show"), ms);
  }

  function fmtDate(iso){
    if(!iso) return "";
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function daysUntil(iso){
    const now = new Date(); now.setHours(0,0,0,0);
    const d = new Date(iso + "T00:00:00");
    return Math.round((d - now) / 86400000);
  }

  function escapeHtml(str){
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  /* ---------------- Navigation ---------------- */

  const views = document.querySelectorAll(".view");
  const navItems = document.querySelectorAll(".nav-item[data-view]");

  function showView(name){
    views.forEach(v => v.classList.toggle("active", v.id === "view-" + name));
    navItems.forEach(n => n.classList.toggle("active", n.dataset.view === name));
    document.getElementById("sidebar").classList.remove("open");
    if(name === "schedule") renderTimetable();
    if(name === "dashboard") renderDashboard();
    if(name === "notes") renderNotesList();
  }

  navItems.forEach(btn => btn.addEventListener("click", () => showView(btn.dataset.view)));
  document.querySelectorAll("[data-view-link]").forEach(btn=>{
    btn.addEventListener("click", ()=> showView(btn.dataset.viewLink));
  });

  document.getElementById("menuToggle").addEventListener("click", ()=>{
    document.getElementById("sidebar").classList.toggle("open");
  });

  /* ---------------- Clock ---------------- */

  function tickClock(){
    const now = new Date();
    const time = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    document.getElementById("clock").textContent = time;
    document.getElementById("mobileClock").textContent = time;
    document.getElementById("todayLine").textContent =
      now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  }
  tickClock();
  setInterval(tickClock, 15000);

  /* ================================================================
     DASHBOARD
     ================================================================ */

  function renderDashboard(){
    // stats
    const weekAhead = state.assignments.filter(a => !a.done && daysUntil(a.due) >= 0 && daysUntil(a.due) <= 7).length;
    document.getElementById("statDueWeek").textContent = weekAhead;
    document.getElementById("statOpenTasks").textContent = state.tasks.filter(t=>!t.done).length;
    document.getElementById("statStreak").textContent = computeBestStreak();
    document.getElementById("statFocus").textContent = state.pomodoro.sessionsLog.filter(iso => isToday(iso)).length;

    // today's classes
    const todayAbbr = DAY_ORDER[ (new Date().getDay() + 6) % 7 ]; // Mon=0..Fri=4, Sat/Sun -> outside range
    const box = document.getElementById("todayClasses");
    const todays = [];
    state.courses.forEach(c=>{
      c.meetings.filter(m=>m.day === todayAbbr).forEach(m=> todays.push({course:c, m}));
    });
    todays.sort((a,b)=> a.m.start.localeCompare(b.m.start));
    box.innerHTML = todays.length ? todays.map(({course,m})=>`
      <div class="class-row" style="border-left-color:${course.color}">
        <span class="time">${m.start}–${m.end}</span>
        <div class="meta">
          <span class="code">${course.code} · ${m.type}</span>
          <span class="room">${m.room}</span>
        </div>
      </div>`).join("") : `<div class="empty">No classes scheduled today.</div>`;

    // upcoming (assignments, next 5 by due date, not done)
    const upcoming = state.assignments
      .filter(a=>!a.done)
      .sort((a,b)=> a.due.localeCompare(b.due))
      .slice(0,5);
    const upcomingBox = document.getElementById("upcomingList");
    upcomingBox.innerHTML = upcoming.length ? upcoming.map(a=>{
      const c = courseByCode(a.course);
      const du = daysUntil(a.due);
      const overdue = du < 0;
      return `<div class="upcoming-row ${overdue?'overdue':''}">
        <span class="chip" style="background:${c?c.color:'#555'}22;color:${c?c.color:'#aaa'}">${a.course||'—'}</span>
        <span class="title">${escapeHtml(a.title)}</span>
        <span class="due">${overdue? 'Overdue' : (du===0?'Today':fmtDate(a.due))}</span>
      </div>`;
    }).join("") : `<div class="empty">Nothing due — you're clear.</div>`;
  }

  function isToday(iso){
    const d = new Date(iso);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }

  function computeBestStreak(){
    if(!state.habits.length) return 0;
    return Math.max(0, ...state.habits.map(h => currentStreak(h)));
  }

  function currentStreak(habit){
    let streak = 0;
    let d = new Date(); d.setHours(0,0,0,0);
    while(true){
      const iso = d.toISOString().slice(0,10);
      if(habit.log && habit.log.includes(iso)){
        streak++;
        d.setDate(d.getDate()-1);
      } else break;
    }
    return streak;
  }

  /* ================================================================
     SCHEDULE / TIMETABLE
     ================================================================ */

  const DAY_START_MIN = 8*60;   // 8:00
  const DAY_END_MIN = 18*60;    // 18:00
  const PX_PER_MIN = 26/30;     // matches 26px row height per 30-min grid-auto-rows

  function toMin(hhmm){
    const [h,m] = hhmm.split(":").map(Number);
    return h*60+m;
  }

  function renderTimetable(){
    document.getElementById("scheduleSub").textContent =
      `${state.term.name} · ${fmtDate(state.term.start)} – ${fmtDate(state.term.end)}`;

    const tt = document.getElementById("timetable");
    tt.innerHTML = "";

    const totalRows = (DAY_END_MIN - DAY_START_MIN) / 30;
    tt.style.gridTemplateRows = `26px repeat(${totalRows}, 26px)`;

    // corner
    const corner = document.createElement("div");
    tt.appendChild(corner);

    // day headers
    DAY_ORDER.forEach(d=>{
      const h = document.createElement("div");
      h.className = "tt-head";
      h.textContent = d;
      tt.appendChild(h);
    });

    // hour labels + gridlines
    for(let min = DAY_START_MIN; min < DAY_END_MIN; min += 30){
      const label = document.createElement("div");
      label.className = "tt-hourlabel";
      if(min % 60 === 0){
        const hour = Math.floor(min/60);
        label.textContent = (hour>12? hour-12: hour) + (hour>=12?"pm":"am");
      }
      tt.appendChild(label);
      for(let i=0;i<5;i++){
        const line = document.createElement("div");
        line.style.borderTop = "1px solid var(--border)";
        tt.appendChild(line);
      }
    }

    // position blocks absolutely within grid using inline grid-row/col
    tt.style.position = "relative";
    const gridBody = document.createElement("div");
    gridBody.style.position = "absolute";
    gridBody.style.top = "26px"; // header height
    gridBody.style.left = "56px";
    gridBody.style.right = "0";
    gridBody.style.bottom = "0";
    gridBody.style.display = "grid";
    gridBody.style.gridTemplateColumns = "repeat(5, 1fr)";

    state.courses.forEach(course=>{
      course.meetings.forEach(m=>{
        const dayIdx = DAY_ORDER.indexOf(m.day);
        if(dayIdx === -1) return;
        const startMin = toMin(m.start) - DAY_START_MIN;
        const endMin = toMin(m.end) - DAY_START_MIN;
        const block = document.createElement("div");
        block.className = "tt-block";
        block.style.position = "absolute";
        block.style.left = `calc(${dayIdx} * (100% / 5))`;
        block.style.width = `calc(100% / 5)`;
        block.style.top = (startMin * PX_PER_MIN) + "px";
        block.style.height = Math.max(20,(endMin-startMin) * PX_PER_MIN) + "px";
        block.style.background = course.color;
        block.title = `${course.code} ${m.type} — ${m.room}`;
        block.innerHTML = `<span class="b-code">${course.code}</span><span class="b-meta">${m.type} · ${m.room}</span>`;
        gridBody.appendChild(block);
      });
    });
    gridBody.style.height = ((DAY_END_MIN-DAY_START_MIN) * PX_PER_MIN) + "px";
    tt.appendChild(gridBody);

    // online courses list
    const onlineBox = document.getElementById("onlineCourses");
    const onlineCourses = state.courses.filter(c=>c.online);
    onlineBox.innerHTML = onlineCourses.map(c=>`
      <div class="online-chip" style="border-left-color:${c.color}">
        <span class="code">${c.code}</span>
        <span class="title">${escapeHtml(c.title)}</span>
      </div>`).join("");
  }

  /* ================================================================
     GENERIC MODAL FORM BUILDER
     ================================================================ */

  function openModal(html, onMount){
    const backdrop = document.getElementById("modalBackdrop");
    const modal = document.getElementById("modal");
    modal.innerHTML = html;
    backdrop.classList.remove("hidden");
    if(onMount) onMount(modal);
    backdrop.onclick = (e)=>{ if(e.target === backdrop) closeModal(); };
  }
  function closeModal(){
    document.getElementById("modalBackdrop").classList.add("hidden");
  }

  function courseOptions(selected){
    const opts = ['<option value="">No course</option>']
      .concat(state.courses.map(c=>`<option value="${c.code}" ${c.code===selected?'selected':''}>${c.code}</option>`));
    return opts.join("");
  }

  /* ================================================================
     ASSIGNMENTS
     ================================================================ */

  function renderAssignments(){
    const box = document.getElementById("assignmentsList");
    const items = [...state.assignments].sort((a,b)=> a.done - b.done || a.due.localeCompare(b.due));
    document.getElementById("badgeAssignments").textContent = state.assignments.filter(a=>!a.done).length;
    box.innerHTML = items.length ? items.map(a=>{
      const c = courseByCode(a.course);
      const du = daysUntil(a.due);
      const overdue = !a.done && du < 0;
      return `<div class="item-row ${a.done?'done':''}" data-id="${a.id}">
        <div class="item-check ${a.done?'checked':''}" data-action="toggle">${a.done?'✓':''}</div>
        <span class="priority-dot priority-${a.priority}"></span>
        <div class="item-body">
          <div class="item-title">${escapeHtml(a.title)}</div>
          <div class="item-sub">
            ${c?`<span class="chip" style="background:${c.color}22;color:${c.color}">${c.code}</span>`:''}
            <span style="${overdue?'color:var(--danger)':''}">${a.due? (overdue?'Overdue · ':'') + fmtDate(a.due) : 'No date'}</span>
          </div>
        </div>
        <div class="item-actions">
          <button class="icon-btn" data-action="edit">✎</button>
          <button class="icon-btn" data-action="delete">✕</button>
        </div>
      </div>`;
    }).join("") : `<div class="empty">No assignments yet. Add your first one.</div>`;
  }

  function assignmentForm(existing){
    const a = existing || { title:"", course:"", due:"", priority:"med", notes:"" };
    openModal(`
      <h3>${existing?'Edit':'New'} assignment</h3>
      <div class="form-row"><label>Title</label><input id="fTitle" value="${escapeHtml(a.title)}" placeholder="e.g. Lab 3 — OOP inheritance"></div>
      <div class="form-row"><label>Course</label><select id="fCourse">${courseOptions(a.course)}</select></div>
      <div class="form-row"><label>Due date</label><input id="fDue" type="date" value="${a.due}"></div>
      <div class="form-row"><label>Priority</label>
        <select id="fPriority">
          <option value="low" ${a.priority==='low'?'selected':''}>Low</option>
          <option value="med" ${a.priority==='med'?'selected':''}>Medium</option>
          <option value="high" ${a.priority==='high'?'selected':''}>High</option>
        </select>
      </div>
      <div class="form-row"><label>Notes</label><textarea id="fNotes">${escapeHtml(a.notes||"")}</textarea></div>
      <div class="modal-actions">
        <button class="btn-ghost" id="cancelBtn">Cancel</button>
        <button class="btn-primary" id="saveBtn">Save</button>
      </div>
    `, (modal)=>{
      modal.querySelector("#cancelBtn").onclick = closeModal;
      modal.querySelector("#saveBtn").onclick = ()=>{
        const title = modal.querySelector("#fTitle").value.trim();
        if(!title){ toast("Give it a title first."); return; }
        const payload = {
          title,
          course: modal.querySelector("#fCourse").value,
          due: modal.querySelector("#fDue").value,
          priority: modal.querySelector("#fPriority").value,
          notes: modal.querySelector("#fNotes").value.trim(),
        };
        if(existing){
          Object.assign(existing, payload);
        }else{
          state.assignments.push(Object.assign({ id: uid(), done:false }, payload));
        }
        saveState(); renderAssignments(); renderDashboard(); closeModal();
        toast("Saved.");
      };
    });
  }

  document.getElementById("addAssignmentBtn").addEventListener("click", ()=> assignmentForm(null));

  document.getElementById("assignmentsList").addEventListener("click", (e)=>{
    const row = e.target.closest(".item-row");
    if(!row) return;
    const id = row.dataset.id;
    const item = state.assignments.find(x=>x.id===id);
    const action = e.target.closest("[data-action]")?.dataset.action;
    if(action === "toggle"){ item.done = !item.done; saveState(); renderAssignments(); renderDashboard(); }
    if(action === "edit"){ assignmentForm(item); }
    if(action === "delete"){
      state.assignments = state.assignments.filter(x=>x.id!==id);
      saveState(); renderAssignments(); renderDashboard(); toast("Deleted.");
    }
  });

  /* ================================================================
     TASKS
     ================================================================ */

  function renderTasks(){
    const box = document.getElementById("tasksList");
    const items = [...state.tasks].sort((a,b)=> a.done - b.done);
    document.getElementById("badgeTasks").textContent = state.tasks.filter(t=>!t.done).length;
    box.innerHTML = items.length ? items.map(t=>`
      <div class="item-row ${t.done?'done':''}" data-id="${t.id}">
        <div class="item-check ${t.done?'checked':''}" data-action="toggle">${t.done?'✓':''}</div>
        <div class="item-body"><div class="item-title">${escapeHtml(t.title)}</div></div>
        <div class="item-actions"><button class="icon-btn" data-action="delete">✕</button></div>
      </div>`).join("") : `<div class="empty">No tasks. Add something quick.</div>`;
  }

  function taskForm(){
    openModal(`
      <h3>New task</h3>
      <div class="form-row"><label>What needs doing?</label><input id="fTitle" placeholder="e.g. Email advisor about co-op"></div>
      <div class="modal-actions">
        <button class="btn-ghost" id="cancelBtn">Cancel</button>
        <button class="btn-primary" id="saveBtn">Add</button>
      </div>
    `, (modal)=>{
      modal.querySelector("#cancelBtn").onclick = closeModal;
      const input = modal.querySelector("#fTitle");
      input.focus();
      const submit = ()=>{
        const title = input.value.trim();
        if(!title) return;
        state.tasks.push({ id: uid(), title, done:false });
        saveState(); renderTasks(); renderDashboard(); closeModal();
      };
      modal.querySelector("#saveBtn").onclick = submit;
      input.addEventListener("keydown", e=>{ if(e.key==="Enter") submit(); });
    });
  }

  document.getElementById("addTaskBtn").addEventListener("click", taskForm);
  document.getElementById("tasksList").addEventListener("click", (e)=>{
    const row = e.target.closest(".item-row"); if(!row) return;
    const id = row.dataset.id;
    const item = state.tasks.find(x=>x.id===id);
    const action = e.target.closest("[data-action]")?.dataset.action;
    if(action === "toggle"){ item.done = !item.done; saveState(); renderTasks(); renderDashboard(); }
    if(action === "delete"){ state.tasks = state.tasks.filter(x=>x.id!==id); saveState(); renderTasks(); renderDashboard(); }
  });

  /* ================================================================
     GOALS
     ================================================================ */

  function renderGoals(){
    const box = document.getElementById("goalsList");
    box.innerHTML = state.goals.length ? state.goals.map(g=>`
      <div class="item-row goal-row" data-id="${g.id}">
        <div class="item-body">
          <div class="item-title">${escapeHtml(g.title)}</div>
          <div class="progress-track"><div class="progress-fill" style="width:${g.progress}%"></div></div>
          <div class="item-sub">${g.progress}% complete</div>
        </div>
        <div class="item-actions">
          <button class="icon-btn" data-action="inc">+10%</button>
          <button class="icon-btn" data-action="delete">✕</button>
        </div>
      </div>`).join("") : `<div class="empty">No goals set yet.</div>`;
  }

  document.getElementById("addGoalBtn").addEventListener("click", ()=>{
    openModal(`
      <h3>New goal</h3>
      <div class="form-row"><label>Goal</label><input id="fTitle" placeholder="e.g. Finish Scholar OS sync feature"></div>
      <div class="modal-actions"><button class="btn-ghost" id="cancelBtn">Cancel</button><button class="btn-primary" id="saveBtn">Add</button></div>
    `, modal=>{
      modal.querySelector("#cancelBtn").onclick = closeModal;
      modal.querySelector("#saveBtn").onclick = ()=>{
        const title = modal.querySelector("#fTitle").value.trim();
        if(!title) return;
        state.goals.push({ id: uid(), title, progress: 0 });
        saveState(); renderGoals(); closeModal();
      };
    });
  });

  document.getElementById("goalsList").addEventListener("click", (e)=>{
    const row = e.target.closest(".item-row"); if(!row) return;
    const id = row.dataset.id;
    const g = state.goals.find(x=>x.id===id);
    const action = e.target.closest("[data-action]")?.dataset.action;
    if(action === "inc"){ g.progress = Math.min(100, g.progress+10); saveState(); renderGoals(); }
    if(action === "delete"){ state.goals = state.goals.filter(x=>x.id!==id); saveState(); renderGoals(); }
  });

  /* ================================================================
     HABITS
     ================================================================ */

  function todayIso(){ return new Date().toISOString().slice(0,10); }

  function renderHabits(){
    const box = document.getElementById("habitsList");
    box.innerHTML = state.habits.length ? state.habits.map(h=>{
      const last7 = [...Array(7)].map((_,i)=>{
        const d = new Date(); d.setDate(d.getDate() - (6-i));
        const iso = d.toISOString().slice(0,10);
        return (h.log||[]).includes(iso);
      });
      const doneToday = (h.log||[]).includes(todayIso());
      return `<div class="item-row habit-row" data-id="${h.id}">
        <div class="item-check ${doneToday?'checked':''}" data-action="toggleToday">${doneToday?'✓':''}</div>
        <div class="item-body">
          <div class="item-title">${escapeHtml(h.title)}</div>
          <div class="habit-days">${last7.map(f=>`<span class="habit-dayflag ${f?'filled':''}"></span>`).join("")}</div>
          <div class="item-sub">Streak: ${currentStreak(h)} days</div>
        </div>
        <div class="item-actions"><button class="icon-btn" data-action="delete">✕</button></div>
      </div>`;
    }).join("") : `<div class="empty">No habits tracked yet.</div>`;
  }

  document.getElementById("addHabitBtn").addEventListener("click", ()=>{
    openModal(`
      <h3>New habit</h3>
      <div class="form-row"><label>Habit</label><input id="fTitle" placeholder="e.g. Review flashcards"></div>
      <div class="modal-actions"><button class="btn-ghost" id="cancelBtn">Cancel</button><button class="btn-primary" id="saveBtn">Add</button></div>
    `, modal=>{
      modal.querySelector("#cancelBtn").onclick = closeModal;
      modal.querySelector("#saveBtn").onclick = ()=>{
        const title = modal.querySelector("#fTitle").value.trim();
        if(!title) return;
        state.habits.push({ id: uid(), title, log: [] });
        saveState(); renderHabits(); closeModal();
      };
    });
  });

  document.getElementById("habitsList").addEventListener("click", (e)=>{
    const row = e.target.closest(".item-row"); if(!row) return;
    const id = row.dataset.id;
    const h = state.habits.find(x=>x.id===id);
    const action = e.target.closest("[data-action]")?.dataset.action;
    if(action === "toggleToday"){
      h.log = h.log || [];
      const t = todayIso();
      if(h.log.includes(t)) h.log = h.log.filter(d=>d!==t);
      else h.log.push(t);
      saveState(); renderHabits(); renderDashboard();
    }
    if(action === "delete"){ state.habits = state.habits.filter(x=>x.id!==id); saveState(); renderHabits(); }
  });

  /* ================================================================
     NOTES
     ================================================================ */

  let activeNoteId = null;

  function renderNotesList(){
    const box = document.getElementById("notesList");
    const sorted = [...state.notes].sort((a,b)=> (b.updated||"").localeCompare(a.updated||""));
    box.innerHTML = sorted.length ? sorted.map(n=>{
      const c = courseByCode(n.course);
      return `<div class="note-item ${n.id===activeNoteId?'active':''}" data-id="${n.id}">
        <div class="n-title">${escapeHtml(n.title || "Untitled")}</div>
        <div class="n-meta">${c?c.code+' · ':''}${n.updated?fmtDate(n.updated.slice(0,10)):''}</div>
      </div>`;
    }).join("") : `<div class="empty">No notes yet.</div>`;

    const sel = document.getElementById("noteCourseSelect");
    sel.innerHTML = courseOptions();

    if(activeNoteId){
      loadNoteIntoEditor(state.notes.find(n=>n.id===activeNoteId));
    }
  }

  function loadNoteIntoEditor(note){
    if(!note) return;
    document.getElementById("noteTitleInput").value = note.title || "";
    document.getElementById("noteCourseSelect").value = note.course || "";
    document.getElementById("noteEditor").innerHTML = note.body || "";
  }

  function currentNote(){ return state.notes.find(n=>n.id===activeNoteId); }

  document.getElementById("addNoteBtn").addEventListener("click", ()=>{
    const note = { id: uid(), title: "Untitled note", course: "", body: "", updated: new Date().toISOString() };
    state.notes.push(note);
    activeNoteId = note.id;
    saveState(); renderNotesList();
    document.getElementById("noteTitleInput").focus();
  });

  document.getElementById("notesList").addEventListener("click", (e)=>{
    const item = e.target.closest(".note-item"); if(!item) return;
    activeNoteId = item.dataset.id;
    renderNotesList();
  });

  let saveDebounce;
  function debouncedSaveNote(){
    clearTimeout(saveDebounce);
    saveDebounce = setTimeout(()=>{
      const n = currentNote(); if(!n) return;
      n.title = document.getElementById("noteTitleInput").value;
      n.course = document.getElementById("noteCourseSelect").value;
      n.body = document.getElementById("noteEditor").innerHTML;
      n.updated = new Date().toISOString();
      saveState();
      renderNotesList();
    }, 500);
  }

  document.getElementById("noteTitleInput").addEventListener("input", debouncedSaveNote);
  document.getElementById("noteCourseSelect").addEventListener("change", debouncedSaveNote);
  // Use 'input' (not blur/focusout) so autosave never steals focus from the editor mid-type
  document.getElementById("noteEditor").addEventListener("input", debouncedSaveNote);

  document.getElementById("editorToolbar").addEventListener("click", (e)=>{
    const btn = e.target.closest("button"); if(!btn) return;
    document.getElementById("noteEditor").focus();
    document.execCommand(btn.dataset.cmd, false, btn.dataset.val || null);
    debouncedSaveNote();
  });

  /* ================================================================
     POMODORO
     ================================================================ */

  const POMO_DURATIONS = { focus: 25*60, short: 5*60, long: 15*60 };
  let pomoMode = "focus";
  let pomoRemaining = POMO_DURATIONS.focus;
  let pomoRunning = false;
  let pomoInterval = null;
  const RING_CIRC = 2 * Math.PI * 90;

  function renderPomo(){
    const mins = Math.floor(pomoRemaining/60).toString().padStart(2,"0");
    const secs = (pomoRemaining%60).toString().padStart(2,"0");
    document.getElementById("pomoTime").textContent = `${mins}:${secs}`;
    const total = POMO_DURATIONS[pomoMode];
    const pct = pomoRemaining/total;
    document.getElementById("pomoRingFg").style.strokeDasharray = RING_CIRC;
    document.getElementById("pomoRingFg").style.strokeDashoffset = RING_CIRC * (1-pct);
    document.getElementById("pomoSessionsToday").textContent =
      state.pomodoro.sessionsLog.filter(iso=>isToday(iso)).length;
  }

  document.querySelectorAll(".pomo-mode").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      document.querySelectorAll(".pomo-mode").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      pomoMode = btn.dataset.mode;
      pauseTimer();
      pomoRemaining = POMO_DURATIONS[pomoMode];
      renderPomo();
    });
  });

  function startTimer(){
    pomoRunning = true;
    document.getElementById("pomoStart").textContent = "Pause";
    pomoInterval = setInterval(()=>{
      pomoRemaining--;
      if(pomoRemaining <= 0){
        pauseTimer();
        if(pomoMode === "focus"){
          state.pomodoro.sessionsLog.push(new Date().toISOString());
          saveState();
          toast("Focus session complete. Nice work.");
          notify("Focus session complete", "Time for a break.");
        } else {
          toast("Break's over.");
          notify("Break's over", "Back to it when you're ready.");
        }
        pomoRemaining = POMO_DURATIONS[pomoMode];
      }
      renderPomo();
    }, 1000);
  }
  function pauseTimer(){
    pomoRunning = false;
    clearInterval(pomoInterval);
    document.getElementById("pomoStart").textContent = "Start";
  }

  document.getElementById("pomoStart").addEventListener("click", ()=> pomoRunning ? pauseTimer() : startTimer());
  document.getElementById("pomoReset").addEventListener("click", ()=>{
    pauseTimer();
    pomoRemaining = POMO_DURATIONS[pomoMode];
    renderPomo();
  });

  /* ================================================================
     FLASHCARDS
     ================================================================ */

  let studyDeckId = null;
  let studyIndex = 0;
  let studyFlipped = false;

  function renderDecks(){
    const grid = document.getElementById("deckGrid");
    grid.innerHTML = state.decks.length ? state.decks.map(d=>`
      <div class="deck-card" data-id="${d.id}">
        <h3>${escapeHtml(d.title)}</h3>
        <p>${d.cards.length} card${d.cards.length===1?'':'s'}</p>
      </div>`).join("") : `<div class="empty">No decks yet. Create one to start studying.</div>`;
  }

  document.getElementById("addDeckBtn").addEventListener("click", ()=>{
    openModal(`
      <h3>New deck</h3>
      <div class="form-row"><label>Deck name</label><input id="fTitle" placeholder="e.g. SQL joins"></div>
      <div class="modal-actions"><button class="btn-ghost" id="cancelBtn">Cancel</button><button class="btn-primary" id="saveBtn">Create</button></div>
    `, modal=>{
      modal.querySelector("#cancelBtn").onclick = closeModal;
      modal.querySelector("#saveBtn").onclick = ()=>{
        const title = modal.querySelector("#fTitle").value.trim();
        if(!title) return;
        state.decks.push({ id: uid(), title, cards: [] });
        saveState(); renderDecks(); closeModal();
        toast("Deck created — open it to add cards.");
      };
    });
  });

  document.getElementById("deckGrid").addEventListener("click", (e)=>{
    const card = e.target.closest(".deck-card"); if(!card) return;
    openDeckManager(card.dataset.id);
  });

  function openDeckManager(deckId){
    const deck = state.decks.find(d=>d.id===deckId);
    renderDeckManagerModal(deck);
  }

  function renderDeckManagerModal(deck){
    openModal(`
      <h3>${escapeHtml(deck.title)}</h3>
      <div id="cardsMini" style="display:flex;flex-direction:column;gap:6px;max-height:220px;overflow-y:auto;margin-bottom:12px;"></div>
      <div class="form-row"><label>Front</label><input id="fFront" placeholder="Question"></div>
      <div class="form-row"><label>Back</label><input id="fBack" placeholder="Answer"></div>
      <div class="modal-actions">
        <button class="btn-ghost" id="deleteDeckBtn">Delete deck</button>
        <button class="btn-primary" id="addCardBtn">Add card</button>
      </div>
      <div class="modal-actions">
        <button class="btn-ghost" id="closeBtn">Close</button>
        <button class="btn-primary" id="studyBtn" ${deck.cards.length?'':'disabled'}>Study deck</button>
      </div>
    `, modal=>{
      function refreshMini(){
        modal.querySelector("#cardsMini").innerHTML = deck.cards.length ? deck.cards.map((c,i)=>`
          <div class="item-row" style="padding:8px 10px;">
            <div class="item-body"><div class="item-title" style="font-size:12.5px;">${escapeHtml(c.front)}</div></div>
            <button class="icon-btn" data-i="${i}">✕</button>
          </div>`).join("") : `<div class="empty" style="padding:8px 0;">No cards yet.</div>`;
      }
      refreshMini();
      modal.querySelector("#cardsMini").addEventListener("click", e=>{
        const btn = e.target.closest("[data-i]"); if(!btn) return;
        deck.cards.splice(Number(btn.dataset.i),1);
        saveState(); refreshMini(); renderDecks();
        modal.querySelector("#studyBtn").disabled = !deck.cards.length;
      });
      modal.querySelector("#addCardBtn").onclick = ()=>{
        const front = modal.querySelector("#fFront").value.trim();
        const back = modal.querySelector("#fBack").value.trim();
        if(!front || !back){ toast("Fill in both sides."); return; }
        deck.cards.push({ front, back });
        saveState(); refreshMini(); renderDecks();
        modal.querySelector("#fFront").value = "";
        modal.querySelector("#fBack").value = "";
        modal.querySelector("#studyBtn").disabled = false;
        modal.querySelector("#fFront").focus();
      };
      modal.querySelector("#deleteDeckBtn").onclick = ()=>{
        state.decks = state.decks.filter(d=>d.id!==deck.id);
        saveState(); renderDecks(); closeModal(); toast("Deck deleted.");
      };
      modal.querySelector("#closeBtn").onclick = closeModal;
      modal.querySelector("#studyBtn").onclick = ()=>{
        closeModal();
        startStudy(deck.id);
      };
    });
  }

  function startStudy(deckId){
    studyDeckId = deckId; studyIndex = 0; studyFlipped = false;
    document.getElementById("studyCard").classList.remove("hidden");
    renderStudyCard();
    document.getElementById("studyCard").scrollIntoView({behavior:"smooth", block:"start"});
  }

  function renderStudyCard(){
    const deck = state.decks.find(d=>d.id===studyDeckId);
    if(!deck || !deck.cards.length){ document.getElementById("studyCard").classList.add("hidden"); return; }
    document.getElementById("studyDeckTitle").textContent = deck.title;
    const c = deck.cards[studyIndex];
    document.getElementById("flashcardFace").textContent = studyFlipped ? c.back : c.front;
    document.getElementById("cardProgress").textContent = `${studyIndex+1} / ${deck.cards.length}`;
  }

  document.getElementById("flashcard").addEventListener("click", ()=>{
    studyFlipped = !studyFlipped;
    renderStudyCard();
  });
  document.getElementById("cardNext").addEventListener("click", ()=>{
    const deck = state.decks.find(d=>d.id===studyDeckId); if(!deck) return;
    studyIndex = (studyIndex+1) % deck.cards.length;
    studyFlipped = false; renderStudyCard();
  });
  document.getElementById("cardPrev").addEventListener("click", ()=>{
    const deck = state.decks.find(d=>d.id===studyDeckId); if(!deck) return;
    studyIndex = (studyIndex-1+deck.cards.length) % deck.cards.length;
    studyFlipped = false; renderStudyCard();
  });
  document.getElementById("closeStudy").addEventListener("click", ()=>{
    document.getElementById("studyCard").classList.add("hidden");
  });

  /* ================================================================
     NOTIFICATIONS
     ================================================================ */

  function notify(title, body){
    if(!("Notification" in window)) return;
    if(Notification.permission === "granted"){
      try{ new Notification(title, { body, icon: "" }); }catch(e){ /* no-op */ }
    }
  }

  document.getElementById("enableNotifs").addEventListener("click", async ()=>{
    if(!("Notification" in window)){ toast("Notifications aren't supported in this browser."); return; }
    const perm = await Notification.requestPermission();
    toast(perm === "granted" ? "Notifications enabled." : "Notifications blocked.");
  });

  /* ================================================================
     SETTINGS: export / import / reset
     ================================================================ */

  document.getElementById("exportData").addEventListener("click", ()=>{
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `scholar-os-export-${todayIso()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("importData").addEventListener("click", ()=>{
    document.getElementById("importFile").click();
  });
  document.getElementById("importFile").addEventListener("change", (e)=>{
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      try{
        const incoming = JSON.parse(reader.result);
        state = Object.assign(defaultState(), incoming);
        state.courses = COURSES; state.term = TERM_INFO;
        saveState();
        renderAll();
        toast("Import complete.");
      }catch(err){
        toast("That file couldn't be read.");
      }
    };
    reader.readAsText(file);
  });

  document.getElementById("resetData").addEventListener("click", ()=>{
    openModal(`
      <h3>Reset app?</h3>
      <p class="sub">This erases all local data — assignments, tasks, notes, decks, everything. This can't be undone.</p>
      <div class="modal-actions">
        <button class="btn-ghost" id="cancelBtn">Cancel</button>
        <button class="btn-danger" id="confirmBtn">Erase everything</button>
      </div>
    `, modal=>{
      modal.querySelector("#cancelBtn").onclick = closeModal;
      modal.querySelector("#confirmBtn").onclick = ()=>{
        localStorage.removeItem(STORAGE_KEY);
        state = defaultState();
        saveState(); renderAll(); closeModal();
        toast("All data cleared.");
      };
    });
  });

  /* ================================================================
     INIT
     ================================================================ */

  function renderAll(){
    document.getElementById("brandTerm").textContent = state.term.name.replace("DC ","");
    renderDashboard();
    renderTimetable();
    renderAssignments();
    renderTasks();
    renderGoals();
    renderHabits();
    renderNotesList();
    renderDecks();
    renderPomo();
  }

  renderAll();

  // service worker registration (safe no-op if file missing)
  if("serviceWorker" in navigator){
    window.addEventListener("load", ()=>{
      navigator.serviceWorker.register("sw.js").catch(()=>{ /* offline support optional */ });
    });
  }

})();
