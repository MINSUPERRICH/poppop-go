import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, updateDoc, onSnapshot, query, serverTimestamp, doc, deleteDoc, increment, setDoc } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { MapPin, User, ShoppingBag, QrCode, ChevronLeft, Plus, X, Map as MapIcon, Grid, Navigation, Search, Camera, LogIn, Clock, Calendar, ChevronRight, Loader2, Trash2, CheckCircle2, RefreshCw, Banknote, Heart, MessageCircle, AlertTriangle, Share2, Flame, Info, Edit3, TrendingUp, Flag, ShieldBan } from 'lucide-react';

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
  const [blockedMerchants, setBlockedMerchants] = useState([]); 
  const [selectedDrop, setSelectedDrop] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [itemImageLoading, setItemImageLoading] = useState(false);
  const [menuItemInput, setMenuItemInput] = useState({ name: '', price: '', image: '', stock: 'in-stock' });
  const [newDrop, setNewDrop] = useState({
    title: '', description: '', locationName: '', zelleId: '', phone: '', images: [], type: 'static', menu: [], closesAt: '', eventDate: new Date().toISOString().split('T')[0]
  });

  // Auth listener
  useEffect(() => {
    return onAuthStateChanged(popAuth, (u) => setUser(u));
  }, []);

  // Fetch Drops
  useEffect(() => {
    const q = query(collection(popDb, 'artifacts', APP_PATH, 'public', 'data', 'drops'));
    return onSnapshot(q, (s) => setDrops(s.docs.map(d => ({id: d.id, ...d.data()}))));
  }, []);

  // UGC REQUIREMENT: Fetch Blocked Merchants for current user
  useEffect(() => {
    if (!user) {
      setBlockedMerchants([]);
      return;
    }
    const q = query(collection(popDb, 'users', user.uid, 'blocked'));
    return onSnapshot(q, (s) => setBlockedMerchants(s.docs.map(d => d.data().merchantId)));
  }, [user]);

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
      const finalUpdates = { ...updates, updatedAt: serverTimestamp() };
      if (updates.locationName) finalUpdates.createdAt = serverTimestamp();
      await updateDoc(doc(popDb, 'artifacts', APP_PATH, 'public', 'data', 'drops', dropId), finalUpdates);
      alert("Store Updated!");
    } catch (e) { alert("Update failed."); }
  };

  // UGC REQUIREMENT: Report Content
  const handleReportContent = async () => {
    if (!user) return alert("Please log in to report content.");
    const reason = prompt("Why are you reporting this store? (e.g., Inappropriate content, misleading, scam)");
    if (reason) {
      await addDoc(collection(popDb, 'reports'), {
        dropId: selectedDrop.id,
        merchantId: selectedDrop.merchantId,
        reportedBy: user.uid,
        reason: reason,
        createdAt: serverTimestamp(),
        status: 'pending-review'
      });
      alert("Thank you. Our moderation team will review this within 24 hours.");
    }
  };

  // UGC REQUIREMENT: Block Merchant
  const handleBlockMerchant = async () => {
    if (!user) return alert("Please log in to block users.");
    if (confirm("Are you sure you want to block this merchant? You will no longer see their stores.")) {
      await setDoc(doc(popDb, 'users', user.uid, 'blocked', selectedDrop.merchantId), {
        merchantId: selectedDrop.merchantId,
        blockedAt: serverTimestamp()
      });
      alert("Merchant blocked.");
      setView('explore');
    }
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
    return <div id="detail-map" className="h-48 w-full rounded-3xl border border-slate-100 shadow-inner my-4 z-0"></div>;
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
                <input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="Search neighborhood gems..." className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-3xl shadow-sm outline-none font-bold text-sm"/>
            </div>

            <div className="grid gap-6">
                {drops
                .filter(d => !blockedMerchants.includes(d.merchantId)) // UGC REQUIREMENT: Filter out blocked
                .filter(d => d.title.toLowerCase().includes(searchTerm.toLowerCase()))
                .sort((a, b) => {
                    const aIsHot = (a.hypes || 0) >= 20 ? 1 : 0;
                    const bIsHot = (b.hypes || 0) >= 20 ? 1 : 0;
                    if (aIsHot !== bIsHot) return bIsHot - aIsHot;
                    return b.createdAt?.seconds - a.createdAt?.seconds;
                })
                .map(d => (
                  <div key={d.id} onClick={() => { setSelectedDrop(d); setView('shop-detail'); }} className="bg-white rounded-[32px] overflow-hidden border border-slate-100 shadow-sm active:scale-[0.98] transition-all relative">
                    {(d.hypes || 0) >= 20 && (
                        <div className="absolute top-4 right-4 z-10 bg-orange-600 text-white text-[9px] font-black px-3 py-1.5 rounded-full shadow-xl flex items-center gap-1 animate-pulse">
                            <TrendingUp size={12}/> TRENDING
                        </div>
                    )}
                    <img src={d.images?.[0]} className="w-full h-64 object-cover" />
                    <div className="p-6 flex justify-between items-center">
                        <div className="space-y-1">
                          <h3 className="font-black text-2xl tracking-tight leading-none mb-1">{d.title}</h3>
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest leading-none">{d.locationName.split(',')[0]}</p>
                        </div>
                        <div className="flex items-center gap-1 text-orange-500 font-black text-[10px] uppercase bg-orange-50 px-3 py-1.5 rounded-full">
                            <Flame size={12}/> {d.hypes || 0} Hot
                        </div>
                    </div>
                  </div>
                ))}
            </div>

            {/* PRIVACY POLICY LINK REQUIREMENT */}
            <div className="pt-8 pb-12 text-center">
              <p className="text-xs text-slate-400 font-medium">
                By using PopPop Go, you agree to our <br/>
                <a href="https://www.poppopnow.com/privacy.html" target="_blank" rel="noreferrer" className="text-indigo-600 underline font-bold mt-1 inline-block">Privacy Policy & Terms of Service</a>
              </p>
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
                            <span className="bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Active Now</span>
                        </div>
                        <p className="text-slate-400 text-sm font-bold leading-tight">{selectedDrop.locationName}</p>
                    </div>

                    <DetailMap drop={selectedDrop} />

                    {selectedDrop.description && (
                      <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Info size={14}/> Merchant Story</p>
                        <p className="text-sm font-medium text-slate-600 italic leading-relaxed">"{selectedDrop.description}"</p>
                      </div>
                    )}

                    <div className="flex flex-col gap-3">
                        <button onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedDrop.locationName)}`)} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all"><Navigation size={18}/> View Directions</button>
                        <div className="flex gap-2">
                            <button onClick={(e) => { e.stopPropagation(); updateDoc(doc(popDb, 'artifacts', APP_PATH, 'public', 'data', 'drops', selectedDrop.id), { hypes: increment(1) }); }} className="flex-1 bg-orange-50 text-orange-600 py-5 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 border border-orange-100 active:scale-95 transition-transform"><Flame size={20}/> {selectedDrop.hypes || 0} Hype</button>
                            <button onClick={() => { const msg = `Join me at ${selectedDrop.title}! poppopnow.com`; if(navigator.share) navigator.share({title: selectedDrop.title, text: msg, url: 'https://poppopnow.com'}); else {navigator.clipboard.writeText(msg); alert("Link copied!");} }} className="flex-1 bg-slate-100 text-slate-600 py-5 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 active:scale-95 transition-transform"><Share2 size={18}/> Share Squad</button>
                        </div>
                    </div>

                    <div className="space-y-6 pt-8 border-t border-slate-100">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Store Inventory</p>
                        <div className="grid grid-cols-1 gap-4">
                            {selectedDrop.menu?.map((item, i) => (
                                <div key={i} className={`bg-white rounded-[32px] border border-slate-100 p-4 flex items-center gap-5 shadow-sm transition-all ${item.stock === 'sold-out' ? 'opacity-40 grayscale' : ''}`}>
                                    <img src={item.image} className="w-24 h-24 rounded-[24px] object-cover shadow-inner" />
                                    <div className="flex-1">
                                        <p className="font-black text-2xl text-slate-800 tracking-tight leading-none mb-1">{item.name}</p>
                                        <p className="font-black text-indigo-600 text-xl tracking-tighter leading-none">$ {item.price}</p>
                                        {item.stock === 'low-stock' && <span className="text-[8px] font-black text-orange-500 uppercase flex items-center gap-1 mt-2 animate-pulse"><AlertTriangle size={10}/> Limited Supply</span>}
                                    </div>
                                    <ChevronRight className="text-slate-200" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* UGC REQUIREMENT: Reporting & Blocking UI */}
                    <div className="pt-8 border-t border-slate-100 flex flex-col gap-3">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-center">Safety & Moderation</p>
                        <div className="flex gap-2">
                          <button onClick={handleReportContent} className="flex-1 py-4 bg-red-50 text-red-600 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"><Flag size={14}/> Report Listing</button>
                          <button onClick={handleBlockMerchant} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"><ShieldBan size={14}/> Block Merchant</button>
                        </div>
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
                <div className="space-y-3 bg-slate-50 p-4 rounded-3xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Revise Spot (Date or Move)</p>
                    <div className="flex gap-2">
                        <input type="date" className="flex-1 p-3 rounded-xl border border-slate-200 font-bold text-xs outline-none bg-white" onChange={(e) => handleUpdateListing(myDrop.id, { eventDate: e.target.value })} value={myDrop.eventDate} />
                        <button onClick={() => { const newLoc = prompt("New Place Name?", myDrop.locationName); if(newLoc) handleUpdateListing(myDrop.id, { locationName: newLoc }); }} className="p-3 bg-white text-indigo-600 rounded-xl border border-slate-200"><Edit3 size={18}/></button>
                    </div>
                    <button onClick={() => { navigator.geolocation.getCurrentPosition(async (pos) => { await updateDoc(doc(popDb, 'artifacts', APP_PATH, 'public', 'data', 'drops', myDrop.id), { lat: pos.coords.latitude, lng: pos.coords.longitude, updatedAt: serverTimestamp() }); alert("Verified Location!"); }); }} className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"><RefreshCw size={16}/> Confirm GPS Location</button>
                </div>
              </div>
            ))}
            <button onClick={() => setView('post')} className="w-full py-6 border-2 border-dashed border-indigo-200 bg-indigo-50/50 rounded-[32px] text-indigo-600 font-black text-xs uppercase tracking-widest">+ NEW LISTING</button>
          </div>
        )}

        {view === 'post' && (
          <div className="p-8 space-y-8 pb-40">
            <h2 className="text-4xl font-black italic tracking-tighter">Go Live</h2>
            <div className="space-y-5">
              <input value={newDrop.title} onChange={e=>setNewDrop({...newDrop, title: e.target.value})} placeholder="Store Name *" className="w-full p-5 rounded-2xl border border-slate-200 outline-none font-black shadow-sm" />
              <textarea value={newDrop.description} onChange={e=>setNewDrop({...newDrop, description: e.target.value})} placeholder="Tell your store story... (Optional)" className="w-full p-5 rounded-2xl border border-slate-200 outline-none font-bold text-sm h-32" />
              <input value={newDrop.locationName} onChange={e=>setNewDrop({...newDrop, locationName: e.target.value})} placeholder="Street Corner / Neighborhood" className="w-full p-5 rounded-2xl border border-slate-200 outline-none font-bold" />
              <div className="flex gap-2">
                  <input value={newDrop.zelleId} onChange={e=>setNewDrop({...newDrop, zelleId: e.target.value})} placeholder="Zelle (Opt)" className="flex-1 p-5 rounded-2xl border border-slate-200 font-bold" />
                  <input value={newDrop.phone} onChange={e=>setNewDrop({...newDrop, phone: e.target.value})} placeholder="Phone (Opt)" className="flex-1 p-5 rounded-2xl border border-slate-200 font-bold" />
              </div>
              <label className="block w-full h-64 border-2 border-dashed rounded-[32px] flex flex-col items-center justify-center text-slate-400 border-slate-200 bg-white overflow-hidden cursor-pointer shadow-inner">
                {newDrop.images.length > 0 ? <img src={newDrop.images[0]} className="w-full h-full object-cover" /> : <><Camera size={40} className="text-slate-300" /><span className="text-[10px] font-black mt-4 uppercase tracking-widest">Take Store Photo</span></>}
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => { const url = await uploadToFirebase(e.target.files[0], 'drops'); setNewDrop({...newDrop, images: [url]}); }} />
              </label>
              <div className="p-6 bg-slate-900 rounded-[32px] space-y-4 shadow-2xl">
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Live Menu</p>
                <div className="flex gap-3">
                  <label className="w-16 h-16 bg-white/10 rounded-xl flex items-center justify-center cursor-pointer overflow-hidden">
                    {itemImageLoading ? <Loader2 className="animate-spin text-white"/> : menuItemInput.image ? <img src={menuItemInput.image} className="w-full h-full object-cover" /> : <Camera size={20} className="text-white/20"/>}
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => { setItemImageLoading(true); try { const url = await uploadToFirebase(e.target.files[0], 'items'); setMenuItemInput({...menuItemInput, image: url}); } finally { setItemImageLoading(false); } }} />
                  </label>
                  <div className="flex-1 space-y-2">
                    <input value={menuItemInput.name} onChange={e=>setMenuItemInput({...menuItemInput, name: e.target.value})} placeholder="Item Name" className="w-full px-4 py-2 bg-white/5 rounded-lg text-white font-bold outline-none text-sm" />
                    <input value={menuItemInput.price} onChange={e=>setMenuItemInput({...menuItemInput, price: e.target.value})} placeholder="$ Price" className="w-full px-4 py-2 bg-white/5 rounded-lg text-white font-bold outline-none text-sm" />
                  </div>
                </div>
                <button onClick={() => { if(menuItemInput.image && menuItemInput.name) { setNewDrop({...newDrop, menu: [...newDrop.menu, menuItemInput]}); setMenuItemInput({name:'', price:'', image:'', stock: 'in-stock'}); } }} className="w-full py-3 bg-white text-slate-900 rounded-xl font-black text-[10px] uppercase">Add to Menu</button>
              </div>
              <button onClick={handlePostDrop} disabled={isPosting} className="w-full bg-indigo-600 text-white py-6 rounded-[32px] font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-all">{isPosting ? <Loader2 className="animate-spin mx-auto"/> : 'Go Live'}</button>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-slate-900/95 backdrop-blur-2xl rounded-[35px] py-4 px-10 flex justify-between items-center z-[100] shadow-2xl border border-white/10">
        <button onClick={() => setView('explore')} className={view === 'explore' ? 'text-white' : 'text-white/30'}><Grid size={24}/></button>
        <button onClick={() => { if(!user) handleLogin(); else setView('post'); }} className="bg-indigo-600 text-white p-6 rounded-[30px] shadow-2xl -mt-16 active:scale-90 transition-transform"><Plus size={32}/></button>
        <button onClick={() => setView('merchant-dash')} className={view === 'merchant-dash' ? 'text-white' : 'text-white/30'}><User size={24}/></button>
      </nav>
    </div>
  );
};

export default App;

