// ============================================================
// Auth helpers. Both hosts and participants sign in with the same
// Google account flow — hosts land in the quiz-builder, participants
// still pick a display name + room code afterwards, but their Google
// uid (not the name they type) is what identifies them in a room.
// ============================================================

import { auth, googleProvider, signInWithPopup, onAuthStateChanged, signOut } from "./firebase.js";

// Opens the Google account picker popup. Returns the signed-in user
// object ({ displayName, email, photoURL, uid, ... }) or throws if the
// user closes the popup / it fails.
export async function signInWithGoogle(){
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutUser(){
  await signOut(auth);
}

// Fires `callback(user)` whenever the sign-in state changes (user is
// `null` when signed out). Useful if a page wants to react to auth
// changes without redirecting anywhere.
export function watchAuthState(callback){
  return onAuthStateChanged(auth, callback);
}

// Use this at the top of any host-only page (create-quiz.html,
// host-live.html). If nobody is signed in, it sends them back to the
// login page instead of letting them see host tools.
export function requireHost(onSignedIn){
  return onAuthStateChanged(auth, (user) => {
    if(!user){
      window.location.href = 'index.html';
      return;
    }
    if(onSignedIn) onSignedIn(user);
  });
}

// Use this at the top of any participant-only page (waiting-room.html,
// play-quiz.html). Participants now sign in with Google too — this is
// how those pages know *which* participant they are (by uid), which is
// what lets two people with the same display name join the same room
// without colliding.
export function requireParticipant(onSignedIn){
  return onAuthStateChanged(auth, (user) => {
    if(!user){
      window.location.href = 'index.html?role=participant';
      return;
    }
    if(onSignedIn) onSignedIn(user);
  });
}
