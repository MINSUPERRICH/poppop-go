import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, onSnapshot, 
  query, serverTimestamp, doc, updateDoc, deleteDoc 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  MapPin, Camera, Share2, Search, User, 
  ShoppingBag, Zap, MessageCircle, QrCode, 
  Heart, ChevronLeft, Plus, X, Instagram,
  ExternalLink, CheckCircle2, Trash2, Send, Power
} from 'lucide-react';

/** * IMPORTANT: Replace the empty strings below with the keys from your 
 * Firebase Console (Project Settings > Web App)
 */
const firebaseConfig = {
  apiKey: "AIzaSyAdphjYs2Xz5c-HPlUt_Bo8GyU-9Ia1pao",
  authDomain: "poppop-90476.firebaseapp.com",
  projectId: "poppop-90476",
  storageBucket: "poppop-90476.firebasestorage.app",
  messagingSenderId: "433925434095",
  appId: "1:433925434095:web:c9c6c9250bd848dbc3491a",
  measurementId: "G-T8EX68XLXR"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const COLLECTION_PATH = 'poppop-social-v1';

const App = () => {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('explore'); 
  const [drops, setDrops] = useState([]);
  const [selectedDrop, setSelectedDrop] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  const [newDrop, setNewDrop] = useState({
    title: '',
    locationName: '',
    zelleId: '',
    igHandle: '',
    imageUrl: 'https://images.unsplash.com/photo-1513116339116-cda188c0353c?auto=format&fit=crop&w=800&q=80',
    priceRange: 'Under $20',
    status: 'live'
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        signInAnonymously(auth).catch(err => console.error("Auth Error:", err));
      } else {
        setUser(currentUser);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'artifacts', COLLECTION_PATH, 'public', 'data', 'drops'));
    return onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setDrops(docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    });
  }, [user]);

  const handlePostDrop = async (e) => {
    e.preventDefault();
    if (!user || isPosting) return;
    setIsPosting(true);
    try {
      await addDoc(collection(db, 'artifacts', COLLECTION_PATH, 'public', 'data', 'drops'), {
        ...newDrop,
        merchantId: user.uid,
        createdAt: serverTimestamp(),
      });
      setView('explore');
      setNewDrop({ ...newDrop, title: '', locationName: '', igHandle: '' });
    } catch (err) { console.error(err); }
    finally { setIsPosting(false); }
  };

  const toggleStatus = async (dropId, currentStatus) => {
    const nextStatus = currentStatus === 'live' ? 'sold-out' : 'live';
    await updateDoc(doc(db, 'artifacts', COLLECTION_PATH, 'public', 'data', 'drops', dropId), { status: nextStatus });
  };

  const deleteDrop = async (dropId) => {
    if (window.confirm("Delete this drop?")) {
      await deleteDoc(doc(db, 'artifacts', COLLECTION_PATH, 'public', 'data', 'drops', dropId));
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#FAFAFA] font-sans max-w-md mx-auto border-x border-slate-200 shadow-2xl relative overflow-hidden">
      <header className="bg-white px-6 pt-12 pb-4 sticky top-0 z-30 border-b border-slate-100 flex justify-between items-center">
        <h1 className="text-2xl font-black tracking-tighter bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500 bg-clip-text text-transparent">PopPop</h1>
        <button onClick={() => setView('merchant-dash')} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
           <User className="w-5 h-5 text-slate-400" />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto pb-32">
        {view === 'explore' && (
          <div className="p-4 space-y-6">
            <div className="flex items-center gap-3 bg-slate-100 border border-slate-200 rounded-full px-5 py-3 shadow-inner">
              <Search className="text-slate-400 w-5 h-5" />
              <input type="text" placeholder="Search local vibes..." className="bg-transparent outline-none text-sm w-full font-medium" />
            </div>

            <div className="space-y-6">
              {drops.map(drop => (
                <div key={drop.id} className={`bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100 ${drop.status !== 'live' ? 'opacity-50 grayscale' : ''}`}>
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden"><img src={drop.imageUrl} className="w-full h-full object-cover" /></div>
                      <div>
                        <p className="text-sm font-bold leading-tight">{drop.title}</p>
                        <p className="text-[10px] text-pink-500 font-bold">{drop.igHandle}</p>
                      </div>
                    </div>
                  </div>
                  <div className="relative aspect-square" onClick={() => { if(drop.status==='live'){setSelectedDrop(drop); setView('shop-detail');} }}>
                    <img src={drop.imageUrl} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-4 flex justify-between items-center">
                    <div className="flex gap-4"><Heart className="w-6 h-6 text-slate-700" /><Send className="w-6 h-6 text-slate-700" /></div>
                    <div className="text-[10px] font-black bg-slate-50 text-slate-500 px-3 py-1.5 rounded-full uppercase"><MapPin className="w-3 h-3" /> {drop.locationName}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'shop-detail' && selectedDrop && (
          <div className="p-8 space-y-6 bg-white min-h-full">
            <button onClick={() => setView('explore')} className="mb-4"><ChevronLeft /></button>
            <h2 className="text-3xl font-black">{selectedDrop.title}</h2>
            <div className="bg-slate-50 p-6 rounded-3xl text-center">
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=Zelle:${selectedDrop.zelleId}`} className="mx-auto w-48 h-48 mb-4" alt="QR" />
              <p className="font-bold text-indigo-600">{selectedDrop.zelleId}</p>
            </div>
            <button onClick={() => setShowPayment(false)} className="w-full bg-black text-white py-4 rounded-2xl font-bold">DONE</button>
          </div>
        )}

        {view === 'post' && (
          <div className="p-8 space-y-6">
            <h2 className="text-2xl font-black">Drop a Spot</h2>
            <form onSubmit={handlePostDrop} className="space-y-4">
              <input required value={newDrop.igHandle} onChange={e => setNewDrop({...newDrop, igHandle: e.target.value})} placeholder="@ig_handle" className="w-full p-4 rounded-xl border" />
              <input required value={newDrop.title} onChange={e => setNewDrop({...newDrop, title: e.target.value})} placeholder="Shop Name" className="w-full p-4 rounded-xl border" />
              <input required value={newDrop.locationName} onChange={e => setNewDrop({...newDrop, locationName: e.target.value})} placeholder="Location" className="w-full p-4 rounded-xl border" />
              <input required value={newDrop.zelleId} onChange={e => setNewDrop({...newDrop, zelleId: e.target.value})} placeholder="Zelle ID" className="w-full p-4 rounded-xl border" />
              <button className="w-full bg-pink-500 text-white py-4 rounded-xl font-bold">GO LIVE</button>
            </form>
          </div>
        )}

        {view === 'merchant-dash' && (
          <div className="p-8 space-y-4">
            <h2 className="text-2xl font-black">Merchant Studio</h2>
            {drops.filter(d => d.merchantId === user?.uid).map(myDrop => (
              <div key={myDrop.id} className="p-4 border rounded-xl flex justify-between items-center">
                <span>{myDrop.title}</span>
                <div className="flex gap-2">
                  <button onClick={() => toggleStatus(myDrop.id, myDrop.status)} className="p-2 bg-slate-100 rounded-lg"><Power className="w-4 h-4" /></button>
                  <button onClick={() => deleteDrop(myDrop.id)} className="p-2 bg-red-50 text-red-500 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
            <button onClick={() => setView('post')} className="w-full py-4 border-2 border-dashed rounded-xl">+ NEW DROP</button>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t py-4 px-12 flex justify-between items-center">
        <button onClick={() => setView('explore')} className="text-slate-400"><ShoppingBag /></button>
        <button onClick={() => setView('post')} className="bg-pink-500 text-white p-4 rounded-full -mt-10"><Plus /></button>
        <button onClick={() => setView('merchant-dash')} className="text-slate-400"><User /></button>
      </nav>
    </div>
  );
};

export default App;