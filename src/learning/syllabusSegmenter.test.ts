import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  detectSubjectsFromPages,
  slicePagesForSubject,
} from './syllabusSegmenter';
import type { SourcePage } from './model';

describe('Syllabus Segmenter for Compiled Multi-Subject Files', () => {
  it('detects multiple subjects with explicit headings and codes', () => {
    const pages: SourcePage[] = [
      {
        page: 1,
        text: 'Table of Contents\n1. Mathematics\n2. Data Structures\n3. Physics',
      },
      {
        page: 2,
        text: 'Course Title: Engineering Mathematics I\nCourse Code: MATH 101\nUnit 1: Differential Calculus and Limits',
      },
      {
        page: 3,
        text: 'Unit 2: Matrices and Linear Algebra\nEigenvalues and eigenvectors.',
      },
      {
        page: 4,
        text: 'Subject Name: Data Structures and Algorithms\nCourse Code: CS 201\nModule 1: Arrays, Stacks, Queues',
      },
      {
        page: 5,
        text: 'Module 2: Trees, Graphs, Sorting algorithms\nQuicksort and mergesort.',
      },
      {
        page: 6,
        text: 'Course Name: Applied Physics\nCourse Code: PHY 102\nUnit 1: Quantum Mechanics and Wave Optics',
      },
    ];

    const subjects = detectSubjectsFromPages(pages);
    assert.equal(subjects.length, 3);

    // Subject 1: Math
    assert.equal(subjects[0].title, 'Engineering Mathematics I');
    assert.equal(subjects[0].courseCode, 'MATH 101');
    assert.equal(subjects[0].startPage, 2);
    assert.equal(subjects[0].endPage, 3);
    assert.equal(subjects[0].pageCount, 2);

    // Subject 2: CS
    assert.equal(subjects[1].title, 'Data Structures and Algorithms');
    assert.equal(subjects[1].courseCode, 'CS 201');
    assert.equal(subjects[1].startPage, 4);
    assert.equal(subjects[1].endPage, 5);
    assert.equal(subjects[1].pageCount, 2);

    // Subject 3: Physics
    assert.equal(subjects[2].title, 'Applied Physics');
    assert.equal(subjects[2].courseCode, 'PHY 102');
    assert.equal(subjects[2].startPage, 6);
    assert.equal(subjects[2].endPage, 6);
    assert.equal(subjects[2].pageCount, 1);
  });

  it('slices pages correctly by boundary page numbers', () => {
    const pages: SourcePage[] = [
      { page: 1, text: 'Cover' },
      { page: 2, text: 'Math P1' },
      { page: 3, text: 'Math P2' },
      { page: 4, text: 'CS P1' },
    ];

    const mathPages = slicePagesForSubject(pages, 2, 3);
    assert.equal(mathPages.length, 2);
    assert.equal(mathPages[0].page, 2);
    assert.equal(mathPages[1].page, 3);

    const csPages = slicePagesForSubject(pages, 4, 4);
    assert.equal(csPages.length, 1);
    assert.equal(csPages[0].page, 4);
  });

  it('handles single subject packets gracefully', () => {
    const pages: SourcePage[] = [
      { page: 1, text: 'Week 1 notes on Biology' },
      { page: 2, text: 'Week 2 notes on Cells' },
    ];

    const subjects = detectSubjectsFromPages(pages);
    assert.equal(subjects.length, 1);
    assert.equal(subjects[0].startPage, 1);
    assert.equal(subjects[0].endPage, 2);
  });
});
