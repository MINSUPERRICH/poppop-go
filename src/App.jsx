import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, updateDoc, onSnapshot, query, serverTimestamp, doc, deleteDoc, increment } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { MapPin, User, ShoppingBag, QrCode, ChevronLeft, Plus, X, Map as MapIcon, Grid, Navigation, Search, Camera, LogIn, Clock, Calendar, ChevronRight, Loader2, Trash2, CheckCircle2, RefreshCw, Banknote, Heart, MessageCircle, AlertTriangle, Share2, Flame, Info, Edit3 } from 'lucide-react';

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
  const MY_ADMIN_EMAIL = "yooeuchan@gmail.com"; 

  const [user, setUser] = useState(null);
  const [view, setView] = useState('explore'); 
  const [drops, setDrops] = useState([]);
  const [selectedDrop, setSelectedDrop] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [itemImageLoading, setItemImageLoading] = useState(false);
  const [menuItemInput, setMenuItemInput] = useState({ name: '', price: '', image: '', stock: 'in-stock' });
  const [newDrop, setNewDrop] = useState({
    title: '', description: '', locationName: '', zelleId: '', phone: '', images: [], type: 'static', menu: [], closesAt: '', eventDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    return onAuthStateChanged(popAuth, (u) => setUser(u));
  }, []);

  useEffect(() => {
    const q = query(collection(popDb, 'artifacts', APP_PATH, 'public', 'data', 'drops'));
    return onSnapshot(q, (s) => setDrops(s.docs.map(d => ({id: d.id, ...d.data()}))));
  }, []);

  const isAdmin = user?.email?.toLowerCase() === MY_ADMIN_EMAIL.toLowerCase();

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
    } catch (e) { alert("GPS Required."); }
    finally { setIsPosting(false); }
  };

  const handleUpdateListing = async (dropId, updates) => {
    try {
      // If location changes, we refresh createdAt to make it "newly listed"
      const finalUpdates = { ...updates, updatedAt: serverTimestamp() };
      if (updates.locationName) finalUpdates.createdAt = serverTimestamp();
      
      await updateDoc(doc(popDb, 'artifacts', APP_PATH, 'public', 'data', 'drops', dropId), finalUpdates);
      alert("Store Updated!");
    } catch (e) { alert("Update failed."); }
  };

  const DetailMap = ({ drop }) => {
    const mapRef = useRef(null);
    useEffect(() => {
      if (!mapRef.current && window.L) {
        const map = window.L.map('detail-map', { zoomControl: false, scrollWheelZoom: false, dragging: false }).setView([drop.lat, drop.lng], 15);
        window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);
        window.L.marker([drop.lat, drop.lng]).addTo(map);
        mapRef.current = map;
      }
    }, [drop]);
    return <div id="detail-map" className="h-48 w-full rounded-2xl border border-slate-100 shadow-inner my-4 z-0"></div>;
  };

  return (
    <div className="flex flex-col h-screen bg-white font-sans max-w-md mx-auto relative overflow-hidden border-x border-slate-100 shadow-2xl">
      <header className="px-6 pt-12 pb-4 flex justify-between items-center bg-white/95 backdrop-blur-md z-50 border-b sticky top-0">
        <h1 className="text-2xl font-black text-indigo-600 italic tracking-tighter cursor-pointer" onClick={() => setView('explore')}>PopPop Go</h1>
        <div className="flex gap-2">
          {!user ? <button onClick={handleLogin} className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-lg"><LogIn size={20}/></button> : <button onClick={() => setView('merchant-dash')} className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100"><User size={20}/></button>}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto relative bg-slate-50">
        {view === 'explore' && (
          <div className="p-5 space-y-6 pb-40">
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
                <input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="Search local ants..." className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-3xl shadow-sm outline-none font-bold text-sm"/>
            </div>
            <div className="grid gap-6">
                {drops.filter(d => d.title.toLowerCase().includes(searchTerm.toLowerCase())).sort((a,b) => b.createdAt?.seconds - a.createdAt?.seconds).map(d => (
                  <div key={d.id} onClick={() => { setSelectedDrop(d); setView('shop-detail'); }} className="bg-white rounded-[32px] overflow-hidden border border-slate-100 shadow-sm active:scale-[0.98] transition-all">
                    <img src={d.images?.[0]} className="w-full h-64 object-cover" />
                    <div className="p-6 flex justify-between items-center">
                        <div className="space-y-1">
                          <h3 className="font-black text-2xl tracking-tight leading-none mb-1">{d.title}</h3>
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest leading-none">{d.locationName.split(',')[0]}</p>
                        </div>
                        <div className="flex items-center gap-1 text-orange-500 font-black text-[10px] uppercase bg-orange-50 px-3 py-1.5 rounded-full"><Flame size={12}/> {d.hypes || 0} Hot</div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {view === 'shop-detail' && selectedDrop && (
            <div className="animate-in slide-in-from-right h-full bg-white z-[60] relative overflow-y-auto pb-40">
                <div className="relative h-72 bg-slate-900">
                    <img src={selectedDrop.images?.[0]} className="w-full h-full object-cover opacity-90" />
                    <button onClick={() => setView('explore')} className="absolute top-6 left-6 bg-white p-3 rounded-2xl shadow-xl"><ChevronLeft/></button>
                </div>
                <div className="p-8 -mt-10 bg-white rounded-t-[40px] relative space-y-8">
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <h2 className="text-4xl font-black tracking-tighter leading-none">{selectedDrop.title}</h2>
                            <span className="bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Active</span>
                        </div>
                        <p className="text-slate-400 text-sm font-bold">{selectedDrop.locationName}</p>
                    </div>
                    <DetailMap drop={selectedDrop} />
                    {selectedDrop.description && (
                      <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                        <p className="text-sm font-medium text-slate-600 italic">"{selectedDrop.description}"</p>
                      </div>
                    )}
                    <div className="flex flex-col gap-3">
                        <button onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedDrop.locationName)}`)} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 shadow-xl"><Navigation size={18}/> Navigation</button>
                        <button onClick={() => updateDoc(doc(popDb, 'artifacts', APP_PATH, 'public', 'data', 'drops', selectedDrop.id), { hypes: increment(1) })} className="w-full bg-orange-50 text-orange-600 py-5 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 border border-orange-100"><Flame size={20}/> {selectedDrop.hypes || 0} Hype</button>
                    </div>
                </div>
            </div>
        )}

        {view === 'merchant-dash' && (
          <div className="p-8 space-y-8 pb-32">
            <h2 className="text-4xl font-black italic tracking-tighter">My Hub</h2>
            {drops.filter(d => isAdmin ? true : d.merchantId === user?.uid).map(myDrop => (
              <div key={myDrop.id} className="bg-white p-6 rounded-[32px] border border-slate-100 space-y-6 shadow-md">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-2xl">{myDrop.title}</h3>
                  <button onClick={async () => { if(confirm("Delete Listing?")) await deleteDoc(doc(popDb, 'artifacts', APP_PATH, 'public', 'data', 'drops', myDrop.id)); }} className="p-3 bg-red-50 text-red-500 rounded-2xl"><Trash2 size={20}/></button>
                </div>
                
                {/* REVISE SECTION */}
                <div className="space-y-3 bg-slate-50 p-4 rounded-2xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quick Adjust (Weather/Move)</p>
                    <div className="flex gap-2">
                        <input type="date" className="flex-1 p-3 rounded-xl border border-slate-200 font-bold text-xs outline-none" onChange={(e) => handleUpdateListing(myDrop.id, { eventDate: e.target.value })} value={myDrop.eventDate} />
                        <button onClick={() => { const newLoc = prompt("Change Place Name?", myDrop.locationName); if(newLoc) handleUpdateListing(myDrop.id, { locationName: newLoc }); }} className="p-3 bg-white text-indigo-600 rounded-xl border border-slate-200"><Edit3 size={16}/></button>
                    </div>
                    <button onClick={() => {
                       navigator.geolocation.getCurrentPosition(async (pos) => {
                         await updateDoc(doc(popDb, 'artifacts', APP_PATH, 'public', 'data', 'drops', myDrop.id), { lat: pos.coords.latitude, lng: pos.coords.longitude, updatedAt: serverTimestamp() });
                         alert("GPS Updated!");
                       });
                    }} className="w-full py-3 bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-2 shadow-sm"><RefreshCw size={14}/> Verified GPS</button>
                </div>
              </div>
            ))}
            <button onClick={() => setView('post')} className="w-full py-6 border-2 border-dashed border-indigo-200 bg-indigo-50/50 rounded-[32px] text-indigo-600 font-black text-xs uppercase">+ NEW LISTING</button>
          </div>
        )}

        {/* ... (Keep Post view same as before) */}
      </main>

      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-slate-900/95 backdrop-blur-2xl rounded-[35px] py-4 px-10 flex justify-between items-center z-[100] shadow-2xl">
        <button onClick={() => setView('explore')} className={view === 'explore' ? 'text-white' : 'text-white/30'}><Grid size={24}/></button>
        <button onClick={() => { if(!user) handleLogin(); else setView('post'); }} className="bg-indigo-600 text-white p-6 rounded-[30px] shadow-2xl -mt-16 active:scale-90 transition-transform"><Plus size={32}/></button>
        <button onClick={() => setView('merchant-dash')} className={view === 'merchant-dash' ? 'text-white' : 'text-white/30'}><User size={24}/></button>
      </nav>
    </div>
  );
};

export default App;
