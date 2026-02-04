import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, onSnapshot, 
  query, serverTimestamp, doc, updateDoc, deleteDoc
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';
import { 
  MapPin, Camera, Share2, Search, User, 
  ShoppingBag, Zap, MessageCircle, QrCode, 
  Heart, ChevronLeft, Plus, X, Power, 
  CheckCircle2, AlertCircle, Trash2, Shield
} from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyAdphjYs2Xz5c-HPlUt_Bo8GyU-9Ia1pao",
  authDomain: "poppop-90476.firebaseapp.com",
  projectId: "poppop-90476",
  storageBucket: "poppop-90476.firebasestorage.app",
  messagingSenderId: "433925434095",
  appId: "1:433925434095:web:c9c6c9250bd848dbc3491a",
  measurementId: "G-T8EX68XLXR"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'poppop-go-v2';

// --- Privacy Policy Component (Internal View) ---
const PrivacyPolicyView = ({ onBack }) => (
  <div className="p-8 pb-32 bg-white min-h-screen animate-in slide-in-from-right">
    <button onClick={onBack} className="flex items-center gap-2 text-slate-500 font-bold mb-8">
      <ChevronLeft className="w-5 h-5" /> BACK
    </button>
    <h1 className="text-3xl font-black mb-6">Privacy Policy</h1>
    <p className="text-sm text-slate-400 mb-8 uppercase font-bold tracking-widest">Effective: Feb 3, 2026</p>
    
    <div className="space-y-8 text-slate-600 leading-relaxed">
      <section>
        <h2 className="text-lg font-bold text-slate-900 mb-2">1. Data Collection</h2>
        <p className="text-sm">PopPop Go collects your location data to show you nearby pop-up shops. Merchants provide their Zelle ID and Instagram handles to facilitate sales.</p>
      </section>
      <section>
        <h2 className="text-lg font-bold text-slate-900 mb-2">2. Data Usage</h2>
        <p className="text-sm">We do not sell your personal data. We only use your information to display active "Drops" on our real-time map.</p>
      </section>
      <section>
        <h2 className="text-lg font-bold text-slate-900 mb-2">3. Payments</h2>
        <p className="text-sm">Transactions happen directly via Zelle. PopPop Go does not process or store your banking details or credit card numbers.</p>
      </section>
    </div>
  </div>
);

const App = () => {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('explore'); // explore, shop-detail, post, merchant-dash, privacy
  const [drops, setDrops] = useState([]);
  const [selectedDrop, setSelectedDrop] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  // New Drop Form State
  const [newDrop, setNewDrop] = useState({
    title: '',
    locationName: '',
    zelleId: '',
    imageUrl: 'https://images.unsplash.com/photo-1513116339116-cda188c0353c?auto=format&fit=crop&w=600&q=80',
    priceRange: 'Under $15',
    status: 'live'
  });

  // Auth & Sync
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const dropsRef = collection(db, 'artifacts', appId, 'public', 'data', 'drops');
    return onSnapshot(query(dropsRef), (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setDrops(docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    });
  }, [user]);

  // Actions
  const handlePostDrop = async (e) => {
    e.preventDefault();
    if (!user) return;
    setIsPosting(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'drops'), {
        ...newDrop,
        merchantId: user.uid,
        createdAt: serverTimestamp(),
      });
      setView('explore');
      setNewDrop({ ...newDrop, title: '', locationName: '' });
    } catch (err) { console.error(err); }
    finally { setIsPosting(false); }
  };

  const toggleStatus = async (id, status) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'drops', id), { 
      status: status === 'live' ? 'sold-out' : 'live' 
    });
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans max-w-md mx-auto border-x border-slate-200 shadow-2xl relative overflow-hidden">
      
      {/* Header - Hidden in Privacy view */}
      {view !== 'privacy' && (
        <header className="bg-white/90 backdrop-blur-md px-6 pt-12 pb-4 sticky top-0 z-30 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-indigo-600">PopPop</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
               <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> {drops.filter(d=>d.status==='live').length} Stores Active
            </p>
          </div>
          <button onClick={() => setView('merchant-dash')} className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center border border-slate-200">
             <User className="w-5 h-5 text-slate-500" />
          </button>
        </header>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        
        {view === 'explore' && (
          <div className="p-4 space-y-6 pb-32">
            <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm">
              <Search className="text-slate-400 w-5 h-5" />
              <input type="text" placeholder="Search cheap spots..." className="bg-transparent outline-none text-sm w-full" />
            </div>

            <div className="space-y-4">
              {drops.map(drop => (
                <div 
                  key={drop.id} 
                  onClick={() => { if(drop.status === 'live') { setSelectedDrop(drop); setView('shop-detail'); } }}
                  className={`bg-white rounded-[32px] overflow-hidden shadow-sm border border-slate-100 ${drop.status !== 'live' ? 'opacity-50 grayscale' : ''}`}
                >
                  <div className="relative h-56">
                    <img src={drop.imageUrl} className="w-full h-full object-cover" />
                    {drop.status === 'live' ? (
                      <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-[10px] font-black">LIVE</div>
                    ) : (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white font-black text-xs">SOLD OUT</div>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="font-bold">{drop.title}</h3>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-1"><MapPin className="w-3 h-3" /> {drop.locationName}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'shop-detail' && selectedDrop && (
          <div className="pb-32">
             <div className="relative h-96">
                <img src={selectedDrop.imageUrl} className="w-full h-full object-cover" />
                <button onClick={() => setView('explore')} className="absolute top-12 left-6 bg-white p-3 rounded-full shadow-lg"><ChevronLeft /></button>
             </div>
             <div className="p-8 space-y-6">
                <h2 className="text-3xl font-black">{selectedDrop.title}</h2>
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                   <p className="text-xs font-bold text-slate-400 uppercase mb-2">Instant Payment</p>
                   <p className="font-bold text-indigo-600">{selectedDrop.zelleId}</p>
                </div>
                <button onClick={() => setShowPayment(true)} className="w-full bg-indigo-600 text-white py-5 rounded-[28px] font-black">PAY VIA ZELLE</button>
             </div>
          </div>
        )}

        {view === 'merchant-dash' && (
          <div className="p-8 space-y-8 pb-40">
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-black">Merchant Studio</h2>
              <button onClick={() => setView('explore')}><X /></button>
            </div>
            
            <div className="space-y-4">
              {drops.filter(d => d.merchantId === user?.uid).map(myDrop => (
                <div key={myDrop.id} className="bg-white p-4 rounded-3xl border border-slate-200 flex items-center gap-4">
                  <div className="flex-1">
                    <p className="font-bold">{myDrop.title}</p>
                    <p className="text-xs text-slate-400 uppercase">{myDrop.status}</p>
                  </div>
                  <button 
                    onClick={() => toggleStatus(myDrop.id, myDrop.status)}
                    className={`p-3 rounded-xl ${myDrop.status === 'live' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}
                  >
                    <Power className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>

            <button onClick={() => setView('post')} className="w-full bg-slate-900 text-white py-5 rounded-[28px] font-black">+ DROP NEW SPOT</button>
            
            {/* GOOGLE PLAY REQUIREMENT: Privacy Policy Link */}
            <button 
              onClick={() => setView('privacy')}
              className="w-full py-4 text-slate-400 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <Shield className="w-4 h-4" /> Privacy Policy
            </button>
          </div>
        )}

        {view === 'post' && (
          <div className="p-8 pb-40 space-y-6">
            <h2 className="text-3xl font-black">New Drop</h2>
            <form onSubmit={handlePostDrop} className="space-y-4">
              <input required value={newDrop.title} onChange={e=>setNewDrop({...newDrop, title:e.target.value})} placeholder="Store Name" className="w-full p-4 rounded-2xl bg-white border" />
              <input required value={newDrop.locationName} onChange={e=>setNewDrop({...newDrop, locationName:e.target.value})} placeholder="Location Hint" className="w-full p-4 rounded-2xl bg-white border" />
              <input required value={newDrop.zelleId} onChange={e=>setNewDrop({...newDrop, zelleId:e.target.value})} placeholder="Zelle ID" className="w-full p-4 rounded-2xl bg-white border" />
              <button disabled={isPosting} className="w-full bg-indigo-600 text-white py-5 rounded-[28px] font-black">
                {isPosting ? 'POSTING...' : 'GO LIVE'}
              </button>
            </form>
          </div>
        )}

        {view === 'privacy' && <PrivacyPolicyView onBack={() => setView('merchant-dash')} />}
      </main>

      {/* Navigation */}
      {view !== 'privacy' && (
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-white/80 backdrop-blur-xl border border-white/40 shadow-2xl rounded-[32px] py-4 px-10 flex justify-between items-center z-40">
          <button onClick={() => setView('explore')} className={view === 'explore' ? 'text-indigo-600' : 'text-slate-300'}><ShoppingBag /></button>
          <button onClick={() => setView('post')} className="bg-indigo-600 p-5 rounded-[24px] shadow-lg shadow-indigo-200 -mt-16"><Plus className="text-white" /></button>
          <button onClick={() => setView('merchant-dash')} className={view === 'merchant-dash' ? 'text-indigo-600' : 'text-slate-300'}><User /></button>
        </nav>
      )}

      {/* Payment Modal */}
      {showPayment && selectedDrop && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center">
          <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm" onClick={() => setShowPayment(false)}></div>
          <div className="relative bg-white w-full max-w-sm rounded-t-[48px] p-10 animate-in slide-in-from-bottom">
            <div className="text-center space-y-8">
              <h3 className="text-2xl font-black italic tracking-tighter">INSTANT ZELLE</h3>
              <div className="bg-white p-6 rounded-[32px] shadow-xl border border-slate-100 mx-auto w-fit">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=Zelle:${selectedDrop.zelleId}`} className="w-44 h-44" alt="QR" />
              </div>
              <p className="font-mono font-black text-indigo-600">{selectedDrop.zelleId}</p>
              <button onClick={() => setShowPayment(false)} className="w-full bg-slate-900 text-white py-5 rounded-[28px] font-black">DONE</button>
            </div>
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .animate-in { animation: fadeIn 0.3s ease-out; }
        .slide-in-from-bottom { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        .slide-in-from-right { animation: slideRight 0.3s ease-out; }
        @keyframes slideRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>
    </div>
  );
};

export default App;
