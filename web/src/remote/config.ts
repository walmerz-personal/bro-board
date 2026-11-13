// Where the board lives online. This is Firebase's public web config: it says
// which project to talk to and is not a secret. What protects the data is
// firebase/firestore.rules.

const useEmulator = import.meta.env.VITE_USE_EMULATOR === 'true';

export const firebaseConfig = useEmulator
  ? { apiKey: 'demo-key', authDomain: 'localhost', projectId: 'demo-bro-board', appId: 'demo-app' }
  : {
      apiKey: 'AIzaSyBwErAJf0MgU9imlsbQc2cnIdSxOg_N8JM',
      authDomain: 'bro-board.firebaseapp.com',
      projectId: 'bro-board',
      storageBucket: 'bro-board.firebasestorage.app',
      messagingSenderId: '1044835642644',
      appId: '1:1044835642644:web:9db04f5c2c71799a47a601',
    };

/** For testing on a computer against a local copy of Firebase. Never on in the published site. */
export const emulator = useEmulator ? { firestorePort: 8085, authPort: 9099 } : null;

/** The address his phone reads documents from, without needing the Firebase library. */
export const documentsUrl = emulator
  ? `http://127.0.0.1:${emulator.firestorePort}/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`
  : `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;

/** The voice used for every recording, matching tools/make-audio.py. */
export const VOICE = 'am_puck';
