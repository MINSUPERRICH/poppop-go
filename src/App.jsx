import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, updateDoc, onSnapshot, query, serverTimestamp, doc, deleteDoc, increment } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { MapPin, User, ShoppingBag, QrCode, ChevronLeft, Plus, X, Map as MapIcon, Grid, Navigation, Search, Camera, LogIn, Clock, Calendar, ChevronRight, Loader2, Trash2, CheckCircle2, RefreshCw, Banknote, Heart, MessageCircle, AlertTriangle, Share2, Flame } from 'lucide-react';

// --- FIREBASE CONFIG ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const popApp = initializeApp(firebaseConfig);
const popAuth = getAuth(popApp);
const popDb = getFirestore(popApp);
const popStorage = getStorage(popApp);
const APP_PATH = "poppop-go-live";

const App = () => {
  // --- 👑 ADMIN CONFIG ---
  const MY_ADMIN_EMAIL = "yooeuchan@gmail.com"; 

  const [user, setUser] = useState(null);
  const [view, setView] = useState('explore'); 
  const [displayMode, setDisplayMode] = useState('list'); 
  const [drops, setDrops] = useState([]);
  const [selectedDrop, setSelectedDrop] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [itemImageLoading, setItemImageLoading] = useState(false);
  const [menuItemInput, setMenuItemInput] = useState({ name: '', price: '', image: '', stock: 'in-stock' });
  const [newDrop, setNewDrop] = useState({
    title: '', locationName: '', zelleId: '', phone: '', images: [], type: 'static', menu: [], closesAt: '', eventDate: new Date().toISOString().split('T')[0]
  });

  const isAdmin = user?.email?.toLowerCase() === MY_ADMIN_EMAIL.toLowerCase();

  useEffect(() => {
    return onAuthStateChanged(popAuth, (u) => setUser(u));
  }, []);

  useEffect(() => {
    const q = query(collection(popDb, 'artifacts', APP_PATH, 'public', 'data', 'drops'));
    return onSnapshot(q, (s) => setDrops(s.docs.map(d => ({id: d.id, ...d.data()}))));
  }, []);

  const handleLogin = async () => {
    try { await signInWithPopup(popAuth, new GoogleAuthProvider()); } catch (e) { alert(e.message); }
  };

  const uploadToFirebase = async (file, path) => {
    const sRef = ref(popStorage, `artifacts/${APP_PATH}/${path}/${Date.now()}_${file.name}`);
    const snap = await uploadBytes(sRef, file);
    return await getDownloadURL(snap.ref);
  };

  const handlePostDrop = async () => {
    if (!newDrop.title) return alert("Required: Store Name");
    setIsPosting(true);
    try {
      const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
      await addDoc(collection(popDb, 'artifacts', APP_PATH, 'public', 'data', 'drops'), {
        ...newDrop, merchantId: user.uid, lat: pos.coords.latitude, lng: pos.coords.longitude, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), hypes: 0
      });
      setView('explore');
      setNewDrop({ title: '', locationName: '', zelleId: '', phone: '', images: [], type: 'static', menu: [], closesAt: '', eventDate: new Date().toISOString().split('T')[0] });
    } catch (e) { alert("GPS Required."); }
    finally { setIsPosting(false); }
  };

  const addHype = async (dropId) => {
    await updateDoc(doc(popDb, 'artifacts', APP_PATH, 'public', 'data', 'drops', dropId), { hypes: increment(1) });
  };

  const shareWithSquad = (drop) => {
    const msg = `Let's hit ${drop.title} at ${drop.locationName} on ${new Date(drop.eventDate).toLocaleDateString()}! Menu here: poppopnow.com`;
    if (navigator.share) { navigator.share({ title: drop.title, text: msg, url: 'https://poppopnow.com' }); }
    else { navigator.clipboard.writeText(msg); alert("Invite copied for group chat!"); }
  };

  const getTimeAgo = (ts) => {
    if (!ts) return "New";
    const mins = Math.floor((new Date() - ts.toDate()) / 60000);
    return mins < 60 ? `${mins}m ago` : `${Math.floor(mins/60)}h ago`;
  };

  return (
    <div className="flex flex-col h-screen bg-white font-sans max-w-md mx-auto relative overflow-hidden text-slate-900 border-x border-slate-200 shadow-2xl">
      
      {/* HEADER */}
      <header className="px-6 pt-12 pb-4 flex justify-between items-center bg-white/95 backdrop-blur-sm z-50 border-b border-slate-50 sticky top-0">
        <h1 className="text-2xl font-black text-indigo-600 italic tracking-tighter cursor-pointer" onClick={() => setView('explore')}>PopPop Go</h1>
        <div className="flex gap-2">
          <button onClick={() => setDisplayMode(displayMode === 'list' ? 'map' : 'list')} className="p-3 rounded-2xl bg-slate-100 text-slate-600 active:scale-90 transition-transform">
            {displayMode === 'list' ? <MapIcon size={20}/> : <Grid size={20}/>}
          </button>
          {!user ? <button onClick={handleLogin} className="p-3 rounded-2xl bg-indigo-600 text-white shadow-lg"><LogIn size={20}/></button> : <button onClick={() => setView('merchant-dash')} className="p-3 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100"><User size={20}/></button>}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto bg-slate-50/50">
        {view === 'explore' && (
          <div className="p-5 space-y-6 pb-40 animate-in fade-in">
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
                <input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="Search the street..." className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-3xl shadow-sm outline-none font-bold text-sm"/>
            </div>

            <div className="grid gap-6">
                {drops.filter(d => d.title.toLowerCase().includes(searchTerm.toLowerCase())).sort((a,b) => b.createdAt?.seconds - a.createdAt?.seconds).map(d => (
                  <div key={d.id} onClick={() => { setSelectedDrop(d); setView('shop-detail'); }} className="bg-white rounded-[32px] overflow-hidden border border-slate-100 shadow-sm active:scale-[0.98] transition-all">
                    <div className="relative h-64 overflow-hidden bg-slate-200">
                        <img src={d.images?.[0]} className="w-full h-full object-cover" />
                        <div className="absolute top-4 left-4 flex gap-2">
                            <span className="bg-white/90 backdrop-blur px-3 py-1.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-1"><Clock size={12} className="text-indigo-600"/> {getTimeAgo(d.updatedAt)}</span>
                            {d.hypes > 0 && <span className="bg-orange-500 text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-1"><Flame size={12}/> {d.hypes} Hot</span>}
                        </div>
                    </div>
                    <div className="p-6">
                        <h3 className="font-black text-xl tracking-tight text-slate-800">{d.title}</h3>
                        <p className="text-xs text-slate-400 font-medium truncate mb-4">{d.locationName}</p>
                        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                            {d.menu?.filter(i => i.stock === 'low-stock').map((item, idx) => (
                                <span key={idx} className="bg-amber-50 text-amber-600 border border-amber-100 px-3 py-1 rounded-full text-[9px] font-black uppercase animate-pulse shrink-0">Low Stock: {item.name}</span>
                            ))}
                        </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {view === 'shop-detail' && selectedDrop && (
            <div className="animate-in slide-in-from-bottom h-full bg-white z-[60] relative overflow-y-auto pb-40">
                <div className="relative h-80 bg-slate-100">
                    <img src={selectedDrop.images?.[0]} className="w-full h-full object-cover" />
                    <button onClick={() => setView('explore')} className="absolute top-6 left-6 bg-white p-3 rounded-2xl shadow-xl"><ChevronLeft/></button>
                </div>
                <div className="p-8 -mt-10 bg-white rounded-t-[40px] relative space-y-8">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <h2 className="text-4xl font-black tracking-tighter">{selectedDrop.title}</h2>
                            <p className="text-indigo-600 text-xs font-black uppercase tracking-widest">{selectedDrop.locationName}</p>
                        </div>
                    </div>

                    {/* INFORMAL SOCIAL BUTTONS */}
                    <div className="flex gap-3">
                        <button onClick={(e) => { e.stopPropagation(); addHype(selectedDrop.id); }} className="flex-1 bg-orange-50 text-orange-600 py-5 rounded-[24px] font-black text-xs uppercase flex items-center justify-center gap-2 border border-orange-100 active:scale-95 transition-transform">
                            <Flame size={20}/> {selectedDrop.hypes || 0} Hype
                        </button>
                        <button onClick={() => shareWithSquad(selectedDrop)} className="flex-1 bg-slate-900 text-white py-5 rounded-[24px] font-black text-xs uppercase flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-transform">
                            <Share2 size={20}/> Send to Squad
                        </button>
                    </div>

                    <div className="flex gap-3">
                        <button onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedDrop.locationName)}`)} className="flex-1 bg-slate-100 text-slate-600 py-5 rounded-[24px] font-black text-xs uppercase flex items-center justify-center gap-2"><Navigation size={18}/> Directions</button>
                        {selectedDrop.phone && <button onClick={() => window.location.href=`sms:${selectedDrop.phone}`} className="w-16 bg-indigo-50 text-indigo-600 rounded-[24px] flex items-center justify-center border border-indigo-100"><MessageCircle size={24}/></button>}
                    </div>
                    
                    {selectedDrop.zelleId && (
                        <button onClick={()=>setShowPayment(true)} className="w-full bg-indigo-600 text-white py-5 rounded-[24px] font-black text-xs uppercase flex items-center justify-center gap-2 shadow-xl shadow-indigo-100"><QrCode size={18}/> Zelle Pay</button>
                    )}

                    <div className="space-y-4 pt-4 border-t border-slate-100">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Street Menu</p>
                        {selectedDrop.menu?.map((item, i) => (
                            <div key={i} onClick={() => setPreviewItem(item)} className={`flex items-center justify-between p-4 rounded-[24px] border transition-all ${item.stock === 'sold-out' ? 'bg-slate-50 opacity-50 grayscale' : 'bg-white border-slate-100 shadow-sm'}`}>
                                <div className="flex items-center gap-4">
                                    <img src={item.image} className="w-16 h-16 rounded-xl object-cover" />
                                    <div>
                                        <span className="font-black text-slate-700 block">{item.name}</span>
                                        {item.stock === 'low-stock' && <span className="text-[8px] font-black text-amber-500 uppercase flex items-center gap-1"><AlertTriangle size={8}/> Limited</span>}
                                        {item.stock === 'sold-out' && <span className="text-[8px] font-black text-red-500 uppercase">Gone</span>}
                                    </div>
                                </div>
                                <span className="font-black text-indigo-600 text-lg">{item.stock === 'sold-out' ? 'X' : `$${item.price}`}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}
        
        {/* ... (Keep your merchant-dash and post views the same) */}
      </main>

      {/* NAV */}
      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-slate-900/90 backdrop-blur-2xl rounded-[35px] py-4 px-10 flex justify-between items-center z-[100] shadow-2xl border border-white/10">
        <button onClick={() => { setView('explore'); setDisplayMode('list'); }} className={view === 'explore' ? 'text-white' : 'text-white/30'}><Grid size={24}/></button>
        <button onClick={() => { if(!user) handleLogin(); else setView('post'); }} className="bg-indigo-600 text-white p-6 rounded-[30px] shadow-2xl -mt-16 active:scale-90 transition-transform"><Plus size={32}/></button>
        <button onClick={() => setView('merchant-dash')} className={view === 'merchant-dash' ? 'text-white' : 'text-white/30'}><User size={24}/></button>
      </nav>
    </div>
  );
};

export default App;
