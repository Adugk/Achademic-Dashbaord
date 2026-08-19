/* =========================================================
   Scholar OS — Fall 2026 course seed data
   Source: MyScheduleBuilder export, Durham College, printed
   2026-08-18. Term: DC Fall 2026, Sep 8 – Dec 18 2026.
   ========================================================= */

const TERM_INFO = {
  name: "DC Fall 2026",
  start: "2026-09-08",
  end: "2026-12-18"
};

/*
  color: used for timetable blocks + course chips throughout the app
  meetings: [{ day: "Mon"|"Tue"|"Wed"|"Thu"|"Fri", start: "HH:MM", end: "HH:MM", type, room }]
  online: true => no scheduled meeting time, shown in "Online & non-scheduled" list
*/
const COURSES = [
  {
    code: "COSC 1200",
    title: "Object-Oriented Programming 1",
    instructor: "Senter, Stephen",
    credits: 6.0,
    color: "#F87171",
    online: false,
    meetings: [
      { day: "Mon", start: "12:10", end: "14:00", type: "Lec", room: "H134" },
      { day: "Thu", start: "16:10", end: "18:00", type: "Lab", room: "C318" },
      { day: "Fri", start: "12:10", end: "14:00", type: "Lec", room: "C320" }
    ]
  },
  {
    code: "INFT 1206",
    title: "Web Development – Fundamentals",
    instructor: "Puffer, Darren",
    credits: 4.0,
    color: "#F472B6",
    online: false,
    meetings: [
      { day: "Tue", start: "08:10", end: "10:00", type: "Lab", room: "C319" },
      { day: "Fri", start: "15:10", end: "17:00", type: "Lec", room: "C316" }
    ]
  },
  {
    code: "INFT 1207",
    title: "Software Testing and Automation",
    instructor: "Abbas, Jahanzeb",
    credits: 4.0,
    color: "#2DD4BF",
    online: false,
    meetings: [
      { day: "Wed", start: "14:10", end: "16:00", type: "Lab", room: "C243" },
      { day: "Thu", start: "12:10", end: "14:00", type: "Lec", room: "C319" }
    ]
  },
  {
    code: "MGMT 1223",
    title: "Systems Development 1",
    instructor: "Khan, Nargis",
    credits: 3.0,
    color: "#38BDF8",
    online: false,
    meetings: [
      { day: "Wed", start: "08:10", end: "10:00", type: "Lec", room: "C243" },
      { day: "Thu", start: "14:10", end: "15:00", type: "Lab", room: "B221" }
    ]
  },
  {
    code: "MGMT 1224",
    title: "Business for IT Professionals",
    instructor: "Tellez, Elizabeth",
    credits: 3.0,
    color: "#FBBF24",
    online: false,
    meetings: [
      { day: "Wed", start: "10:10", end: "12:00", type: "Lec", room: "C243 / Online" }
    ]
  },
  {
    code: "GNED 1119",
    title: "Money Matters",
    instructor: "Kochhar, Harpreet",
    credits: 3.0,
    color: "#4ADE80",
    online: true,
    meetings: []
  },
  {
    code: "ADVI 0006",
    title: "BIT Advising",
    instructor: "Dunlop / St. Onge / Stone / Chilton",
    credits: null,
    color: "#C084FC",
    online: true,
    meetings: []
  },
  {
    code: "GRP 0006",
    title: "Computer Programmer Stream",
    instructor: "Shamas, Mohammad",
    credits: null,
    color: "#60A5FA",
    online: true,
    meetings: []
  },
  {
    code: "GRP 0026",
    title: "Chamber of Commerce Information Stream",
    instructor: "Garrett, Peter",
    credits: null,
    color: "#818CF8",
    online: true,
    meetings: []
  },
  {
    code: "BLCK 1000",
    title: "Block Max (non-course)",
    instructor: "",
    credits: null,
    color: "#EAB308",
    online: true,
    meetings: []
  }
];
