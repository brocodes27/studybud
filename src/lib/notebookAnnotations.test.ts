import assert from 'node:assert/strict';
import test from 'node:test';
import {
  annotationNeedsAttention,
  deriveAnnotationReviewStatus,
  moveNotebookAnnotation,
  normalizeNotebookAnnotations,
  type NotebookAnnotation,
} from './notebookAnnotations';

const approvedAnnotation: NotebookAnnotation = {
  id: 'a-1',
  kind: 'underline',
  tone: 'correct',
  status: 'approved',
  x: 0.2,
  y: 0.3,
  width: 0.4,
  height: 0.04,
  text: 'Correct step',
  confidence: 0.94,
};

test('normalizes and clamps AI annotation coordinates', () => {
  const [annotation] = normalizeNotebookAnnotations([{
    id: 'outside-page',
    kind: 'circle',
    tone: 'incorrect',
    x: -0.4,
    y: 0.95,
    width: 1.8,
    height: 0.5,
    confidence: 4,
    question_number: '3',
  }]);

  assert.equal(annotation.x, 0);
  assert.equal(annotation.y, 0.95);
  assert.equal(annotation.width, 1);
  assert.ok(annotation.height <= 0.051);
  assert.equal(annotation.confidence, 1);
  assert.equal(annotation.question_number, 3);
});

test('drops unknown shapes and makes duplicate ids unique', () => {
  const annotations = normalizeNotebookAnnotations([
    approvedAnnotation,
    { ...approvedAnnotation },
    { ...approvedAnnotation, kind: 'arrow' },
  ]);

  assert.deepEqual(annotations.map(({ id }) => id), ['a-1', 'a-1-2']);
});

test('moves annotations without allowing them to leave the page', () => {
  const moved = moveNotebookAnnotation(approvedAnnotation, 0.9, -0.8);
  assert.equal(moved.x, 0.6);
  assert.equal(moved.y, 0);
});

test('requires review for suggestions and low-confidence approved marks', () => {
  assert.equal(annotationNeedsAttention(approvedAnnotation), false);
  assert.equal(annotationNeedsAttention({ ...approvedAnnotation, confidence: 0.5 }), true);
  assert.equal(annotationNeedsAttention({ ...approvedAnnotation, status: 'suggested' }), true);
});

test('derives page approval only when every annotation is approved', () => {
  assert.equal(deriveAnnotationReviewStatus([]), 'review');
  assert.equal(deriveAnnotationReviewStatus([approvedAnnotation]), 'approved');
  assert.equal(
    deriveAnnotationReviewStatus([{ ...approvedAnnotation, status: 'suggested' }]),
    'review',
  );
});
