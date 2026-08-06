// ============================================================
// Data model (this is what actually lives in Firestore):
//
//   rooms/{roomCode}                  <- one document per quiz room
//     hostEmail, questions[], timerSeconds, shuffle,
//     allowLateJoin, anticopy, maxParticipants,
//     passwordRequired, password, status ("lobby" | "live" | "ended")
//
//   rooms/{roomCode}/participants/{uid}    <- one document per participant
//     uid, name, score, finished, joinedAt
//
// Participants sign in with Google, so their Firebase Auth uid is used
// as the document ID. That's what lets two people with the same display
// name join the same room without overwriting each other.
// ============================================================

import {
  db, doc, setDoc, getDoc, getDocs, updateDoc, onSnapshot,
  collection, query, orderBy, serverTimestamp, writeBatch
} from "./firebase.js";

// ---- rooms ----

export async function createRoom(code, data){
  // Make a copy of each question, but without the "correct" field —
  // this is what participants will be allowed to see.
  const publicQuestions = data.questions.map(q => {
    const { correct, ...rest } = q;
    return rest;
  });

  // Pull out just the correct answers, in order — this stays hidden.
  const answerKey = data.questions.map(q => q.correct);

  const batch = writeBatch(db);

  batch.set(doc(db, "rooms", code), {
    ...data,
    questions: publicQuestions,
    status: "lobby",
    createdAt: serverTimestamp()
  });

  batch.set(doc(db, "rooms", code, "answerKey", "data"), {
    correct: answerKey
  });

  await batch.commit();
}

export async function getRoom(code){
  const snap = await getDoc(doc(db, "rooms", code));
  return snap.exists() ? snap.data() : null;
}

// Fires `callback` immediately with the current data, then again every
// time the room document changes anywhere (other tabs, other devices).
export function listenRoom(code, callback){
  return onSnapshot(doc(db, "rooms", code), (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
}

export async function setRoomStatus(code, status){
  await updateDoc(doc(db, "rooms", code), { status });
}

// ---- participants ----
// Participants are keyed by their Google account uid (not their display
// name) so two people who happen to type the same name don't overwrite
// each other. addParticipant is idempotent: if this uid already has a
// doc in the room (e.g. they refreshed or re-joined), we just refresh
// their name and leave their score/progress alone instead of resetting it.

export async function addParticipant(code, uid, name){
  const ref = doc(db, "rooms", code, "participants", uid);
  const existing = await getDoc(ref);
  if(existing.exists()){
    await updateDoc(ref, { name });
    return;
  }
  await setDoc(ref, {
    uid,
    name,
    score: 0,
    finished: false,
    joinedAt: serverTimestamp()
  });
}

// Real-time list of everyone in the room, always sorted by score.
export function listenParticipants(code, callback){
  const q = query(collection(db, "rooms", code, "participants"), orderBy("score", "desc"));
  return onSnapshot(q, (snap) => {
    const list = [];
    snap.forEach(d => list.push(d.data()));
    callback(list);
  });
}

// One-time read (used by the results page — no need to keep listening
// once the quiz is over).
export async function getParticipantsOnce(code){
  const q = query(collection(db, "rooms", code, "participants"), orderBy("score", "desc"));
  const snap = await getDocs(q);
  const list = [];
  snap.forEach(d => list.push(d.data()));
  return list;
}

export async function submitScore(code, uid, score){
  const ref = doc(db, "rooms", code, "participants", uid);
  await updateDoc(ref, { score, finished: true });
}
