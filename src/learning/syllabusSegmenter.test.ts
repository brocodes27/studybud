import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  detectSubjectsFromPages,
  extractPagesForSubject,
  slicePagesForSubject,
} from "./syllabusSegmenter";
import { detailedCurriculumPages } from "./fixtures/detailedCurriculum";
import type { SourcePage } from "./model";

describe("Syllabus Segmenter for Compiled Multi-Subject Files", () => {
  it("detects multiple subjects with explicit headings and codes", () => {
    const pages: SourcePage[] = [
      {
        page: 1,
        text: "Table of Contents\n1. Mathematics\n2. Data Structures\n3. Physics",
      },
      {
        page: 2,
        text: "Course Title: Engineering Mathematics I\nCourse Code: MATH 101\nUnit 1: Differential Calculus and Limits",
      },
      {
        page: 3,
        text: "Unit 2: Matrices and Linear Algebra\nEigenvalues and eigenvectors.",
      },
      {
        page: 4,
        text: "Subject Name: Data Structures and Algorithms\nCourse Code: CS 201\nModule 1: Arrays, Stacks, Queues",
      },
      {
        page: 5,
        text: "Module 2: Trees, Graphs, Sorting algorithms\nQuicksort and mergesort.",
      },
      {
        page: 6,
        text: "Course Name: Applied Physics\nCourse Code: PHY 102\nUnit 1: Quantum Mechanics and Wave Optics",
      },
    ];

    const subjects = detectSubjectsFromPages(pages);
    assert.equal(subjects.length, 3);

    // Subject 1: Math
    assert.equal(subjects[0].title, "Engineering Mathematics I");
    assert.equal(subjects[0].courseCode, "MATH 101");
    assert.equal(subjects[0].startPage, 2);
    assert.equal(subjects[0].endPage, 3);
    assert.equal(subjects[0].pageCount, 2);

    // Subject 2: CS
    assert.equal(subjects[1].title, "Data Structures and Algorithms");
    assert.equal(subjects[1].courseCode, "CS 201");
    assert.equal(subjects[1].startPage, 4);
    assert.equal(subjects[1].endPage, 5);
    assert.equal(subjects[1].pageCount, 2);

    // Subject 3: Physics
    assert.equal(subjects[2].title, "Applied Physics");
    assert.equal(subjects[2].courseCode, "PHY 102");
    assert.equal(subjects[2].startPage, 6);
    assert.equal(subjects[2].endPage, 6);
    assert.equal(subjects[2].pageCount, 1);
  });

  it("slices pages correctly by boundary page numbers", () => {
    const pages: SourcePage[] = [
      { page: 1, text: "Cover" },
      { page: 2, text: "Math P1" },
      { page: 3, text: "Math P2" },
      { page: 4, text: "CS P1" },
    ];

    const mathPages = slicePagesForSubject(pages, 2, 3);
    assert.equal(mathPages.length, 2);
    assert.equal(mathPages[0].page, 2);
    assert.equal(mathPages[1].page, 3);

    const csPages = slicePagesForSubject(pages, 4, 4);
    assert.equal(csPages.length, 1);
    assert.equal(csPages[0].page, 4);
  });

  it("handles single subject packets gracefully", () => {
    const pages: SourcePage[] = [
      { page: 1, text: "Week 1 notes on Biology" },
      { page: 2, text: "Week 2 notes on Cells" },
    ];

    const subjects = detectSubjectsFromPages(pages);
    assert.equal(subjects.length, 1);
    assert.equal(subjects[0].startPage, 1);
    assert.equal(subjects[0].endPage, 2);
  });
});

describe("Merged curricula across semesters", () => {
  it("separates subjects on a shared page and carries semester context", () => {
    const pages = [
      {
        page: 1,
        text: [
          "Semester I",
          "Course Title: Engineering Mathematics I",
          "Course Code: MA101",
          "Unit 1: Matrices and determinants",
          "Course Title: Applied Physics",
          "Course Code: PH101",
          "Unit 1: Wave optics",
          "II Semester",
          "Course Title: Engineering Mathematics II",
          "Course Code: MA201",
          "Unit 1: Differential equations",
        ].join("\n"),
      },
    ];
    const subjects = detectSubjectsFromPages(pages);
    assert.deepEqual(
      subjects.map((s) => [s.title, s.courseCode, s.semester]),
      [
        ["Engineering Mathematics I", "MA101", "Semester 1"],
        ["Applied Physics", "PH101", "Semester 1"],
        ["Engineering Mathematics II", "MA201", "Semester 2"],
      ],
    );
    const math = extractPagesForSubject(pages, subjects[0]);
    assert.match(math[0].text, /Matrices/);
    assert.doesNotMatch(
      math[0].text,
      /Physics|Wave optics|Differential equations/,
    );
    const physics = extractPagesForSubject(pages, subjects[1]);
    assert.match(physics[0].text, /Wave optics/);
    assert.doesNotMatch(physics[0].text, /II Semester|Mathematics II/);
    assert.equal(subjects[1].pageCount, 1);
  });

  it("finds subjects beyond the first 25 lines without turning body text into courses", () => {
    const pages = [
      {
        page: 1,
        text: [
          "First Semester",
          "Course Name: Physics",
          "Course Code: PHY101",
          ...Array.from(
            { length: 40 },
            (_, n) => `Unit ${n + 1}: Physics topic ${n + 1}`,
          ),
          "Course Name: Chemistry",
          "Course Code: CHE101",
          "Unit 1: Molecular structure",
        ].join("\n"),
      },
    ];
    const subjects = detectSubjectsFromPages(pages);
    assert.deepEqual(
      subjects.map((s) => s.title),
      ["Physics", "Chemistry"],
    );
    assert.ok(subjects.every((s) => s.semester === "Semester 1"));
  });

  it("keeps identical subject names separate in different semesters", () => {
    const pages = [
      {
        page: 1,
        text: "Semester 1\nCourse Title: Project\nCourse Code: CS101\nUnit 1: Planning",
      },
      {
        page: 2,
        text: "Semester 2\nCourse Title: Project\nCourse Code: CS101\nUnit 1: Implementation",
      },
    ];
    const subjects = detectSubjectsFromPages(pages);
    assert.equal(subjects.length, 2);
    assert.deepEqual(
      subjects.map((s) => s.semester),
      ["Semester 1", "Semester 2"],
    );
  });

  it("recognises course-code rows and deduplicates their detailed sections", () => {
    const pages = [
      {
        page: 1,
        text: "Semester III\nCourse Code Course Title L T P Credits\n21CS301 Data Structures 3 0 0 3\n21CS302 Computer Networks 3 0 0 3",
      },
      {
        page: 2,
        text: "Semester III\nCourse Code: 21CS301\nCourse Title: Data Structures\nUnit 1: Arrays and stacks",
      },
      {
        page: 3,
        text: "Course Code: 21CS302\nCourse Title: Computer Networks\nUnit 1: Protocols",
      },
    ];
    const subjects = detectSubjectsFromPages(pages);
    assert.deepEqual(
      subjects.map((s) => [s.title, s.semester]),
      [
        ["Data Structures", "Semester 3"],
        ["Computer Networks", "Semester 3"],
      ],
    );
    const dataStructures = extractPagesForSubject(pages, subjects[0]);
    assert.equal(dataStructures.length, 2);
    assert.match(
      dataStructures.map((p) => p.text).join("\n"),
      /Arrays and stacks/,
    );
    assert.doesNotMatch(
      dataStructures.map((p) => p.text).join("\n"),
      /Computer Networks|Protocols/,
    );
  });

  it("treats repeated headers as continuation pages and ignores contents listings", () => {
    const pages = [
      {
        page: 1,
        text: "Table of Contents\nCS101 Data Structures\nCS102 Networks",
      },
      {
        page: 2,
        text: "Semester IV\nCourse Title: Data Structures\nCourse Code: CS101\nUnit 1: Arrays",
      },
      {
        page: 3,
        text: "Course Title: Data Structures\nCourse Code: CS101\nUnit 2: Trees",
      },
      {
        page: 4,
        text: "Course Title: Networks\nCourse Code: CS102\nUnit 1: Routing",
      },
    ];
    const subjects = detectSubjectsFromPages(pages);
    assert.equal(subjects.length, 2);
    assert.equal(subjects[0].startPage, 2);
    assert.equal(subjects[0].endPage, 3);
    assert.equal(subjects[0].pageCount, 2);
  });

  it("supports uppercase titles under semester headings without course codes", () => {
    const pages = [
      {
        page: 5,
        text: "SEMESTER - V\nDATABASE MANAGEMENT SYSTEMS\nUnit 1: Relational algebra",
      },
      { page: 6, text: "OPERATING SYSTEMS\nUnit 1: Process management" },
    ];
    const subjects = detectSubjectsFromPages(pages);
    assert.deepEqual(
      subjects.map((s) => s.title),
      ["DATABASE MANAGEMENT SYSTEMS", "OPERATING SYSTEMS"],
    );
    assert.ok(subjects.every((s) => s.semester === "Semester 5"));
    assert.equal(subjects[1].endPage, 6);
  });

  it("reads title and code values extracted onto separate lines", () => {
    const pages = [
      {
        page: 1,
        text: "Course Title:\nEngineering Mathematics\nCourse Code:\nMA101\nSemester: VI\nUnit 1: Calculus",
      },
    ];
    const subjects = detectSubjectsFromPages(pages);
    assert.equal(subjects.length, 1);
    assert.equal(subjects[0].title, "Engineering Mathematics");
    assert.equal(subjects[0].courseCode, "MA101");
    assert.equal(subjects[0].semester, "Semester 6");
  });

  it("never invents multiple subjects by dividing a long single-course packet", () => {
    const pages = Array.from({ length: 30 }, (_, i) => ({
      page: i + 1,
      text:
        i === 0
          ? "Course Title: Biology\nCourse Code: BIO101\nUnit 1: Cells"
          : `Unit ${i + 1}: Biology notes\nDetailed teaching content.`,
    }));
    const subjects = detectSubjectsFromPages(pages);
    assert.equal(subjects.length, 1);
    assert.equal(subjects[0].title, "Biology");
    assert.equal(subjects[0].pageCount, 30);
  });

  it("keeps ordinary short paragraphs as a single material", () => {
    const pages = [
      {
        page: 8,
        text: "Introduction to the course\nRead the following notes carefully.",
      },
      {
        page: 9,
        text: "Matrices and linear algebra\nThese ideas follow from the previous lecture.",
      },
    ];
    const subjects = detectSubjectsFromPages(pages);
    assert.equal(subjects.length, 1);
    assert.equal(subjects[0].startPage, 8);
    assert.equal(subjects[0].endPage, 9);
  });
});

it("keeps code-before-title headers paired on a compact shared page", () => {
  const pages = [
    {
      page: 1,
      text: "Semester 1\nCourse Code: MA101\nCourse Title: Mathematics\nUnit 1: Matrices\nCourse Code: PH101\nCourse Title: Physics\nUnit 1: Optics",
    },
  ];
  const subjects = detectSubjectsFromPages(pages);
  assert.deepEqual(
    subjects.map((s) => [s.title, s.courseCode]),
    [
      ["Mathematics", "MA101"],
      ["Physics", "PH101"],
    ],
  );
  assert.doesNotMatch(
    extractPagesForSubject(pages, subjects[0])[0].text,
    /PH101|Optics/,
  );
});

it("uses earlier semester tables for detailed course pages with no semester heading", () => {
  const pages = [
    { page: 1, text: "Semester I\nMA101 Mathematics 3 0 0 3" },
    { page: 2, text: "Semester II\nCS201 Data Structures 3 0 0 3" },
    {
      page: 3,
      text: "Course Code: MA101\nCourse Title: Mathematics\nUnit 1: Matrices",
    },
    {
      page: 4,
      text: "Course Code: CS201\nCourse Title: Data Structures\nUnit 1: Arrays",
    },
  ];
  const subjects = detectSubjectsFromPages(pages);
  assert.deepEqual(
    subjects.map((s) => [s.courseCode, s.semester]),
    [
      ["MA101", "Semester 1"],
      ["CS201", "Semester 2"],
    ],
  );
  assert.match(
    extractPagesForSubject(pages, subjects[0])
      .map((p) => p.text)
      .join("\n"),
    /Matrices/,
  );
  assert.doesNotMatch(
    extractPagesForSubject(pages, subjects[0])
      .map((p) => p.text)
      .join("\n"),
    /Arrays|Data Structures/,
  );
});

it("detects all 22 subjects in the DetailedCurriculam layout in their actual semesters", () => {
  const subjects = detectSubjectsFromPages(detailedCurriculumPages);
  assert.deepEqual(
    subjects.map((s) => [s.title, s.semester]),
    [
      ["Problem Solving and Programming", "Semester 1"],
      ["Mathematics - I", "Semester 1"],
      ["System and Web Essentials", "Semester 1"],
      ["Mathematics-II (Probability & Statistics)", "Semester 2"],
      ["Web Application Programming", "Semester 2"],
      ["Analysis and Design of Algorithms", "Semester 3"],
      ["Database Management System (DBMS)", "Semester 3"],
      ["Advanced Programming", "Semester 3"],
      ["Maths for AI", "Semester 3"],
      ["Discrete Mathematics", "Semester 4"],
      ["Introduction to Machine Learning", "Semester 4"],
      ["Software Engineering", "Semester 4"],
      ["Modern Computer Architecture", "Semester 6"],
      ["Deep Learning", "Semester 6"],
      ["Introduction to AI", "Semester 6"],
      ["Computer Networks", "Semester 6"],
      ["Operating Systems", "Semester 7"],
      ["Computer Vision", "Semester 7"],
      ["Natural Language Processing", "Semester 7"],
      ["Theory of Computation", "Semester 8"],
      ["Compiler Design", "Semester 8"],
      ["Cybersecurity", "Semester 8"],
    ],
  );
  for (const subject of subjects) {
    const text = extractPagesForSubject(detailedCurriculumPages, subject)
      .map((p) => p.text)
      .join("\n");
    assert.equal(
      (text.match(/^Course:/gm) || []).length,
      1,
      `${subject.title} must contain only its own course`,
    );
    assert.doesNotMatch(text, /^Semester\s*[-:]\s*[IVX]+/m);
  }
  const web = subjects.find((s) => s.title === "Web Application Programming")!;
  assert.equal(web.endPage, 14);
  const ai = subjects.find((s) => s.title === "Introduction to AI")!;
  const deep = subjects.find((s) => s.title === "Deep Learning")!;
  assert.equal(deep.endPage, 32);
  assert.equal(ai.startPage, 32);
  assert.equal(ai.endPage, 33);
});
