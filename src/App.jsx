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
    const msg = `Let's hit ${drop.title} at ${drop.locationName}! Menu here: poppopnow.com`;
    if (navigator.share) { navigator.share({ title: drop.title, text: msg, url: 'https://poppopnow.com' }); }
    else { navigator.clipboard.writeText(msg); alert("Invite copied!"); }
  };

  const updateLocation = async (dropId) => {
    try {
      const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
      await updateDoc(doc(popDb, 'artifacts', APP_PATH, 'public', 'data', 'drops', dropId), {
        lat: pos.coords.latitude, lng: pos.coords.longitude, updatedAt: serverTimestamp()
      });
      alert("Location verified!");
    } catch (e) { alert("GPS Error."); }
  };

  const toggleStock = async (dropId, menuIndex, currentStock) => {
    const drop = drops.find(d => d.id === dropId);
    const newMenu = [...drop.menu];
    const statuses = ['in-stock', 'low-stock', 'sold-out'];
    const nextStatus = statuses[(statuses.indexOf(currentStock) + 1) % 3];
    newMenu[menuIndex].stock = nextStatus;
    await updateDoc(doc(popDb, 'artifacts', APP_PATH, 'public', 'data', 'drops', dropId), { menu: newMenu });
  };

  const getTimeAgo = (ts) => {
    if (!ts) return "New";
    const mins = Math.floor((new Date() - ts.toDate()) / 60000);
    return mins < 60 ? `${mins}m ago` : `${Math.floor(mins/60)}h ago`;
  };

  const FullMapView = () => {
    const mapRef = useRef(null);
    useEffect(() => {
      if (!mapRef.current && window.L) {
        const map = window.L.map('full-map', { zoomControl: false, tap: false }).setView([40.7128, -74.0060], 12);
        window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);
        mapRef.current = map;
        drops.forEach(d => {
          const iconHtml = `<div style="background: ${d.type === 'food-truck' ? '#f59e0b' : '#4f46e5'}; color: white; padding: 10px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.2); font-size: 18px;">${d.type === 'food-truck' ? '🚚' : '🛍️'}</div>`;
          const customIcon = window.L.divIcon({ html: iconHtml, className: '', iconSize: [40, 40] });
          const marker = window.L.marker([d.lat, d.lng], { icon: customIcon }).addTo(map);
          marker.bindPopup(`<div style="text-align: center; font-family: sans-serif; padding: 5px;"><strong>${d.title}</strong><br><button id="btn-${d.id}" style="margin-top: 10px; background: #4f46e5; color: white; border: none; padding: 8px 15px; border-radius: 10px; font-weight: 800; width: 100%;">VIEW</button></div>`, { closeButton: false });
          marker.on('popupopen', () => { document.getElementById(`btn-${d.id}`).onclick = () => { setSelectedDrop(d); setView('shop-detail'); }; });
        });
      }
    }, [drops]);
    return <div id="full-map" className="absolute inset-0 z-0"></div>;
  };

  return (
    <div className="flex flex-col h-screen bg-white font-sans max-w-md mx-auto relative overflow-hidden text-slate-900 border-x border-slate-200">
      
      <header className="px-6 pt-12 pb-4 flex justify-between items-center bg-white/95 backdrop-blur-sm z-50 border-b border-slate-50 sticky top-0">
        <h1 className="text-2xl font-black text-indigo-600 italic tracking-tighter cursor-pointer" onClick={() => setView('explore')}>PopPop Go</h1>
        <div className="flex gap-2">
          <button onClick={() => setDisplayMode(displayMode === 'list' ? 'map' : 'list')} className="p-3 rounded-2xl bg-slate-100 text-slate-600 active:scale-90">
            {displayMode === 'list' ? <MapIcon size={20}/> : <Grid size={20}/>}
          </button>
          {!user ? <button onClick={handleLogin} className="p-3 rounded-2xl bg-indigo-600 text-white shadow-lg"><LogIn size={20}/></button> : <button onClick={() => setView('merchant-dash')} className="p-3 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100"><User size={20}/></button>}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto bg-slate-50/50">
        {view === 'explore' && (
          <div className="p-5 space-y-6 pb-40">
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
                            <span className="bg-white/90 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-1"><Clock size={12} className="text-indigo-600"/> {getTimeAgo(d.updatedAt)}</span>
                            {d.hypes > 0 && <span className="bg-orange-500 text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-1"><Flame size={12}/> {d.hypes} Hot</span>}
                        </div>
                    </div>
                    <div className="p-6">
                        <h3 className="font-black text-xl tracking-tight text-slate-800">{d.title}</h3>
                        <p className="text-xs text-slate-400 font-medium truncate mb-4">{d.locationName}</p>
                        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                            {d.menu?.filter(i => i.stock === 'low-stock').map((item, idx) => (
                                <span key={idx} className="bg-amber-50 text-amber-600 border border-amber-100 px-3 py-1 rounded-full text-[9px] font-black uppercase animate-pulse shrink-0">Low: {item.name}</span>
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

                    <div className="flex gap-3">
                        <button onClick={(e) => { e.stopPropagation(); addHype(selectedDrop.id); }} className="flex-1 bg-orange-50 text-orange-600 py-5 rounded-[24px] font-black text-xs uppercase flex items-center justify-center gap-2 border border-orange-100 active:scale-95 transition-transform">
                            <Flame size={20}/> {selectedDrop.hypes || 0} Hype
                        </button>
                        <button onClick={() => shareWithSquad(selectedDrop)} className="flex-1 bg-slate-900 text-white py-5 rounded-[24px] font-black text-xs uppercase flex items-center justify-center gap-2 shadow-xl">
                            <Share2 size={20}/> Send Squad
                        </button>
                    </div>

                    <div className="flex gap-3 border-t pt-8">
                        <button onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedDrop.locationName)}`)} className="flex-1 bg-slate-100 text-slate-600 py-5 rounded-[24px] font-black text-xs uppercase flex items-center justify-center gap-2"><Navigation size={18}/> Navigation</button>
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

        {view === 'merchant-dash' && (
          <div className="p-8 space-y-8 pb-32">
            <div className="flex justify-between items-center border-b pb-6">
              <div><h2 className="text-3xl font-black italic tracking-tighter">My Hub</h2><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ant Management</p></div>
              <button onClick={() => signOut(popAuth)} className="p-3 bg-red-50 text-red-500 rounded-2xl"><LogIn size={20}/></button>
            </div>
            <div className="space-y-6">
              {drops.filter(d => isAdmin ? true : d.merchantId === user?.uid).map(myDrop => (
                <div key={myDrop.id} className="bg-white p-6 rounded-[32px] border border-slate-100 space-y-6 shadow-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <img src={myDrop.images?.[0]} className="w-14 h-14 rounded-xl object-cover" />
                        <h3 className="font-black text-lg">{myDrop.title}</h3>
                    </div>
                    <button onClick={async () => { if(confirm("Delete Listing?")) await deleteDoc(doc(popDb, 'artifacts', APP_PATH, 'public', 'data', 'drops', myDrop.id)); }} className="p-3 bg-red-50 text-red-500 rounded-2xl"><Trash2 size={20}/></button>
                  </div>
                  <button onClick={() => updateLocation(myDrop.id)} className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-emerald-100"><RefreshCw size={16}/> I am here! (Verified Now)</button>
                  <div className="space-y-3 pt-4 border-t">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inventory Levels</p>
                     {myDrop.menu?.map((item, idx) => (
                         <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                             <span className="text-xs font-bold text-slate-700">{item.name}</span>
                             <button onClick={() => toggleStock(myDrop.id, idx, item.stock)} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${item.stock === 'in-stock' ? 'bg-indigo-600 text-white' : item.stock === 'low-stock' ? 'bg-amber-500 text-white' : 'bg-slate-300 text-slate-600'}`}>
                                 {item.stock}
                             </button>
                         </div>
                     ))}
                  </div>
                </div>
              ))}
              <button onClick={() => setView('post')} className="w-full py-6 border-2 border-dashed border-indigo-200 bg-indigo-50/50 rounded-[32px] text-indigo-600 font-black text-xs uppercase tracking-widest shadow-inner">+ NEW SPOT</button>
            </div>
          </div>
        )}

        {view === 'post' && (
          <div className="p-8 space-y-8 pb-40">
            <h2 className="text-4xl font-black italic tracking-tighter">Go Live</h2>
            <div className="space-y-5">
              <input value={newDrop.title} onChange={e=>setNewDrop({...newDrop, title: e.target.value})} placeholder="Store Name *" className="w-full p-5 rounded-2xl border border-slate-200 outline-none font-black shadow-sm" />
              <input value={newDrop.locationName} onChange={e=>setNewDrop({...newDrop, locationName: e.target.value})} placeholder="Address / Street Corner" className="w-full p-5 rounded-2xl border border-slate-200 outline-none font-bold" />
              <div className="flex gap-2">
                  <input value={newDrop.zelleId} onChange={e=>setNewDrop({...newDrop, zelleId: e.target.value})} placeholder="Zelle (Opt)" className="flex-1 p-5 rounded-2xl border border-slate-200 font-bold" />
                  <input value={newDrop.phone} onChange={e=>setNewDrop({...newDrop, phone: e.target.value})} placeholder="Phone (Opt)" className="flex-1 p-5 rounded-2xl border border-slate-200 font-bold" />
              </div>
              
              {/* CAMERA OPTIMIZED UPLOAD (SHOP PHOTO) */}
              <label className="block w-full h-56 border-2 border-dashed rounded-[32px] flex flex-col items-center justify-center text-slate-400 border-slate-200 bg-white overflow-hidden cursor-pointer shadow-inner">
                {newDrop.images.length > 0 ? <img src={newDrop.images[0]} className="w-full h-full object-cover" /> : <><Camera size={40} className="text-slate-200" /><span className="text-[10px] font-black mt-4 uppercase">Capture Shop Front</span></>}
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => { const url = await uploadToFirebase(e.target.files[0], 'drops'); setNewDrop({...newDrop, images: [url]}); }} />
              </label>

              {/* CAMERA OPTIMIZED UPLOAD (MENU ITEM) */}
              <div className="p-6 bg-slate-900 rounded-[32px] space-y-4 shadow-2xl">
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Build Menu</p>
                <div className="flex gap-3">
                  <label className="w-16 h-16 bg-white/10 rounded-xl flex items-center justify-center cursor-pointer shrink-0 overflow-hidden">
                    {itemImageLoading ? <Loader2 className="animate-spin text-white"/> : menuItemInput.image ? <img src={menuItemInput.image} className="w-full h-full object-cover" /> : <Camera size={20} className="text-white/20"/>}
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => { setItemImageLoading(true); try { const url = await uploadToFirebase(e.target.files[0], 'items'); setMenuItemInput({...menuItemInput, image: url}); } finally { setItemImageLoading(false); } }} />
                  </label>
                  <div className="flex-1 space-y-2">
                    <input value={menuItemInput.name} onChange={e=>setMenuItemInput({...menuItemInput, name: e.target.value})} placeholder="Item Name" className="w-full px-4 py-2 bg-white/5 rounded-lg text-white font-bold outline-none" />
                    <input value={menuItemInput.price} onChange={e=>setMenuItemInput({...menuItemInput, price: e.target.value})} placeholder="$ Price" className="w-full px-4 py-2 bg-white/5 rounded-lg text-white font-bold outline-none" />
                  </div>
                </div>
                <button onClick={() => { if(menuItemInput.image && menuItemInput.name) { setNewDrop({...newDrop, menu: [...newDrop.menu, menuItemInput]}); setMenuItemInput({name:'', price:'', image:'', stock: 'in-stock'}); } }} className="w-full py-3 bg-white text-slate-900 rounded-xl font-black text-[10px] uppercase">Add Item</button>
              </div>

              <button onClick={handlePostDrop} disabled={isPosting} className="w-full bg-indigo-600 text-white py-6 rounded-[32px] font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-all">{isPosting ? <Loader2 className="animate-spin mx-auto"/> : 'Publish My Spot'}</button>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-slate-900/90 backdrop-blur-2xl rounded-[35px] py-4 px-10 flex justify-between items-center z-[100] shadow-2xl border border-white/10">
        <button onClick={() => { setView('explore'); setDisplayMode('list'); }} className={view === 'explore' ? 'text-white' : 'text-white/30'}><Grid size={24}/></button>
        <button onClick={() => { if(!user) handleLogin(); else setView('post'); }} className="bg-indigo-600 text-white p-6 rounded-[30px] shadow-2xl -mt-16 active:scale-90 transition-transform"><Plus size={32}/></button>
        <button onClick={() => setView('merchant-dash')} className={view === 'merchant-dash' ? 'text-white' : 'text-white/30'}><User size={24}/></button>
      </nav>
    </div>
  );
};

export default App;
