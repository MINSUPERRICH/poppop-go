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

  const shareSpot = (drop) => {
    const msg = `Meet me at ${drop.title}! See their live menu here: poppopnow.com`;
    if (navigator.share) navigator.share({ title: drop.title, text: msg, url: 'https://poppopnow.com' });
    else { navigator.clipboard.writeText(msg); alert("Link copied!"); }
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
    return <div id="detail-map" className="h-40 w-full rounded-2xl border border-slate-100 shadow-inner my-4 z-0"></div>;
  };

  return (
    <div className="flex flex-col h-screen bg-white font-sans max-w-md mx-auto relative overflow-hidden border-x border-slate-100">
      
      <header className="px-6 pt-12 pb-4 flex justify-between items-center bg-white/95 backdrop-blur-md z-50 border-b sticky top-0">
        <h1 className="text-2xl font-black text-indigo-600 italic tracking-tighter" onClick={() => setView('explore')}>PopPop Go</h1>
        <div className="flex gap-2">
          {!user ? <button onClick={handleLogin} className="p-2.5 rounded-xl bg-indigo-600 text-white"><LogIn size={20}/></button> : <button onClick={() => setView('merchant-dash')} className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600"><User size={20}/></button>}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto relative bg-slate-50">
        {view === 'explore' && (
          <div className="p-5 space-y-6 pb-40">
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
                <input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="Search neighborhood gems..." className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm outline-none font-bold text-sm"/>
            </div>

            <div className="grid gap-6">
                {drops.filter(d => d.title.toLowerCase().includes(searchTerm.toLowerCase())).map(d => (
                  <div key={d.id} onClick={() => { setSelectedDrop(d); setView('shop-detail'); }} className="bg-white rounded-[32px] overflow-hidden border border-slate-100 shadow-sm active:scale-[0.98] transition-all">
                    <img src={d.images?.[0]} className="w-full h-60 object-cover" />
                    <div className="p-6">
                        <h3 className="font-black text-2xl tracking-tight">{d.title}</h3>
                        <p className="text-xs text-slate-400 font-bold mb-2 uppercase tracking-widest">{d.locationName}</p>
                        <div className="flex items-center gap-1 text-orange-500 font-black text-[10px] uppercase">
                            <Flame size={12}/> {d.hypes || 0} Hyped
                        </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {view === 'shop-detail' && selectedDrop && (
            <div className="animate-in slide-in-from-right h-full bg-white z-[60] relative overflow-y-auto pb-40">
                <div className="relative h-72 bg-slate-900">
                    <img src={selectedDrop.images?.[0]} className="w-full h-full object-cover" />
                    <button onClick={() => setView('explore')} className="absolute top-6 left-6 bg-white p-3 rounded-2xl shadow-xl"><ChevronLeft/></button>
                </div>

                <div className="p-8 -mt-10 bg-white rounded-t-[40px] relative space-y-6">
                    {/* STORE IDENTITY */}
                    <div className="space-y-1">
                        <div className="flex justify-between items-start">
                            <h2 className="text-4xl font-black tracking-tighter">{selectedDrop.title}</h2>
                            <span className="bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black uppercase">Active</span>
                        </div>
                        <p className="text-slate-400 text-xs font-bold">{selectedDrop.locationName}</p>
                    </div>

                    {/* MAP UNDER PICTURE */}
                    <DetailMap drop={selectedDrop} />

                    {/* ACTIONS */}
                    <div className="flex flex-col gap-3">
                        <button onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedDrop.locationName)}`)} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 shadow-xl"><Navigation size={18}/> View Directions</button>
                        {selectedDrop.zelleId ? (
                            <button onClick={()=>setShowPayment(true)} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 shadow-xl"><QrCode size={18}/> Pay via Zelle</button>
                        ) : (
                            <div className="w-full bg-emerald-50 text-emerald-600 py-5 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 border border-emerald-100"><Banknote size={18}/> Cash Only Spot</div>
                        )}
                    </div>

                    {/* ITEMS LIST UNDER STORE */}
                    <div className="space-y-6 pt-8 border-t border-slate-100">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">What they brought</p>
                        <div className="grid grid-cols-1 gap-4">
                            {selectedDrop.menu?.map((item, i) => (
                                <div key={i} onClick={() => setPreviewItem(item)} className={`bg-white rounded-3xl border border-slate-100 p-4 flex items-center gap-4 shadow-sm transition-all ${item.stock === 'sold-out' ? 'opacity-40 grayscale' : 'active:scale-95'}`}>
                                    <img src={item.image} className="w-24 h-24 rounded-2xl object-cover" />
                                    <div className="flex-1">
                                        <p className="font-black text-xl text-slate-800 tracking-tight leading-none mb-1">{item.name}</p>
                                        <p className="font-black text-indigo-600 text-lg">$ {item.price}</p>
                                        {item.stock === 'low-stock' && <span className="text-[8px] font-black text-orange-500 uppercase flex items-center gap-1 mt-2"><AlertTriangle size={10}/> Limited Supply</span>}
                                    </div>
                                    <ChevronRight className="text-slate-200" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* ... (Keep Merchant/Post views the same) */}
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
