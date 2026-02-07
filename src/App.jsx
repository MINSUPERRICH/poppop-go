import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, onSnapshot, 
  query, serverTimestamp, doc, deleteDoc
} from 'firebase/firestore';
import { 
  getAuth, onAuthStateChanged, GoogleAuthProvider, 
  signInWithPopup, signOut 
} from 'firebase/auth';
import { 
  getStorage, ref, uploadBytes, getDownloadURL 
} from 'firebase/storage';
import { 
  MapPin, User, ShoppingBag, QrCode, ChevronLeft, 
  Plus, X, Map as MapIcon, Grid, ChevronRight, 
  Loader2, Trash2, Navigation, Search, Camera, LogIn, Share2, CheckCircle2, Check, HelpCircle, Truck, Clock, Calendar
} from 'lucide-react';

// --- FIREBASE CONFIG (Kept from your original) ---
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
  const [sortBy, setSortBy] = useState('newest'); 
  const [drops, setDrops] = useState([]);
  const [selectedDrop, setSelectedDrop] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showFAQ, setShowFAQ] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Merchant States
  const [isPosting, setIsPosting] = useState(false);
  const [itemImageLoading, setItemImageLoading] = useState(false);
  const [menuItemInput, setMenuItemInput] = useState({ name: '', price: '', image: '' });
  const [newDrop, setNewDrop] = useState({
    title: '', locationName: '', zelleId: '', zelleQR: '', images: [], type: 'static', menu: [], closesAt: '', eventDate: new Date().toISOString().split('T')[0]
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
    if (!user) return;
    if (!newDrop.title || !newDrop.zelleId) return alert("Required: Store Name & Zelle ID");
    setIsPosting(true);
    try {
      const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
      await addDoc(collection(popDb, 'artifacts', APP_PATH, 'public', 'data', 'drops'), {
        ...newDrop,
        merchantId: user.uid,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        createdAt: serverTimestamp(),
      });
      setView('explore');
      setNewDrop({ title: '', locationName: '', zelleId: '', zelleQR: '', images: [], type: 'static', menu: [], closesAt: '', eventDate: '' });
    } catch (e) { alert("Enable GPS to go live!"); }
    finally { setIsPosting(false); }
  };

  const MapView = () => {
    const mapRef = useRef(null);
    useEffect(() => {
      if (!mapRef.current && window.L) {
        const map = window.L.map('map-el', { zoomControl: false }).setView([40.7128, -74.0060], 13);
        window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);
        mapRef.current = map;
        navigator.geolocation.getCurrentPosition(p => map.setView([p.coords.latitude, p.coords.longitude], 14));
        
        drops.forEach(d => {
          const iconHtml = `<div style="background: ${d.type === 'food-truck' ? '#f59e0b' : '#4f46e5'}; color: white; padding: 8px; border-radius: 12px; border: 2px solid white; font-size: 16px;">${d.type === 'food-truck' ? '🚚' : '🛍️'}</div>`;
          const customIcon = window.L.divIcon({ html: iconHtml, className: '', iconSize: [35, 35] });
          window.L.marker([d.lat, d.lng], { icon: customIcon }).addTo(map)
            .bindPopup(`<b>${d.title}</b><br><button onclick="window.dispatchEvent(new CustomEvent('openShop', {detail: '${d.id}'}))" style="background:#4f46e5;color:white;border:none;padding:5px 10px;border-radius:5px;margin-top:5px;width:100%">View</button>`);
        });
      }
    }, [drops]);

    useEffect(() => {
        const handleOpenShop = (e) => {
            const drop = drops.find(d => d.id === e.detail);
            if(drop) { setSelectedDrop(drop); setView('shop-detail'); }
        };
        window.addEventListener('openShop', handleOpenShop);
        return () => window.removeEventListener('openShop', handleOpenShop);
    }, [drops]);

    return <div id="map-el" className="h-[65vh] w-full rounded-[32px] border-2 border-slate-100 shadow-inner mt-2"></div>;
  };

  return (
    <div className="flex flex-col h-screen bg-white font-sans max-w-md mx-auto relative overflow-hidden text-slate-900 border-x border-slate-100">
      
      {/* HEADER - Pro Style */}
      <header className="px-6 pt-10 pb-4 flex justify-between items-center border-b border-slate-50 sticky top-0 bg-white/80 backdrop-blur-md z-50">
        <div>
           <h1 className="text-2xl font-black text-indigo-600 italic tracking-tighter" onClick={() => setView('explore')}>PopPop Go</h1>
           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Find Local Gems</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setDisplayMode(displayMode === 'list' ? 'map' : 'list')} className="p-3 rounded-2xl bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors">
            {displayMode === 'list' ? <MapIcon size={20}/> : <Grid size={20}/>}
          </button>
          {!user ? <button onClick={handleLogin} className="p-3 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-100"><LogIn size={20}/></button> : <button onClick={() => setView('merchant-dash')} className="p-3 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100"><User size={20}/></button>}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto bg-slate-50/30">
        {view === 'explore' && (
          <div className="p-5 space-y-6 pb-32">
            {/* Search + Sorting */}
            <div className="space-y-3">
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors"/>
                    <input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="Search by name, city, or food..." className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 ring-indigo-50 outline-none transition-all font-medium"/>
                </div>
                <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
                    <button onClick={() => setSortBy('newest')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${sortBy === 'newest' ? 'bg-slate-900 text-white shadow-xl' : 'bg-white text-slate-400 border border-slate-200'}`}><Clock size={14}/> Recent</button>
                    <button onClick={() => setSortBy('date')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${sortBy === 'date' ? 'bg-slate-900 text-white shadow-xl' : 'bg-white text-slate-400 border border-slate-200'}`}><Calendar size={14}/> Date</button>
                    <button onClick={() => setSortBy('city')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${sortBy === 'city' ? 'bg-slate-900 text-white shadow-xl' : 'bg-white text-slate-400 border border-slate-200'}`}><MapPin size={14}/> City</button>
                </div>
            </div>

            {displayMode === 'list' ? (
              <div className="grid gap-6">
                {drops
                  .filter(d => d.title.toLowerCase().includes(searchTerm.toLowerCase()) || d.locationName.toLowerCase().includes(searchTerm.toLowerCase()))
                  .sort((a, b) => {
                    if (sortBy === 'newest') return b.createdAt?.seconds - a.createdAt?.seconds;
                    if (sortBy === 'date') return new Date(a.eventDate) - new Date(b.eventDate);
                    if (sortBy === 'city') return a.locationName.localeCompare(b.locationName);
                    return 0;
                  })
                  .map(d => (
                  <div key={d.id} onClick={() => { setSelectedDrop(d); setView('shop-detail'); }} className="bg-white rounded-[24px] overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl transition-all cursor-pointer group active:scale-[0.98]">
                    <div className="relative h-60 overflow-hidden">
                        <img src={d.images[0]} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={d.title} />
                        <div className="absolute top-4 left-4 flex gap-2">
                            <span className="bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm flex items-center gap-1.5">
                                {d.type === 'food-truck' ? <Truck size={12} className="text-amber-500"/> : <ShoppingBag size={12} className="text-indigo-600"/>}
                                {d.type === 'food-truck' ? 'Food Truck' : 'Pop-Up'}
                            </span>
                            {d.eventDate && <span className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm">{new Date(d.eventDate).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}</span>}
                        </div>
                    </div>
                    <div className="p-5 flex justify-between items-end">
                      <div className="space-y-1">
                        <h3 className="font-black text-xl tracking-tight">{d.title}</h3>
                        <p className="text-xs text-slate-400 flex items-center gap-1"><MapPin size={14} className="text-red-500 shrink-0"/> {d.locationName}</p>
                        <div className="flex items-center gap-3 pt-2">
                             <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">Until {d.closesAt || 'Late'}</span>
                        </div>
                      </div>
                      <div className="bg-slate-900 text-white p-3 rounded-2xl group-hover:bg-indigo-600 transition-colors"><ChevronRight size={20}/></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <MapView />}
          </div>
        )}

        {view === 'shop-detail' && selectedDrop && (
          <div className="animate-in slide-in-from-right pb-32">
            <div className="relative h-80">
                <img src={selectedDrop.images[0]} className="w-full h-full object-cover" alt={selectedDrop.title} />
                <button onClick={() => setView('explore')} className="absolute top-6 left-6 bg-white/20 backdrop-blur-xl border border-white/30 text-white p-3 rounded-2xl shadow-lg"><ChevronLeft /></button>
            </div>
            <div className="p-8 -mt-12 bg-white rounded-t-[40px] relative z-10 space-y-8 shadow-2xl">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                    <h2 className="text-4xl font-black tracking-tighter">{selectedDrop.title}</h2>
                    <p className="text-indigo-600 text-xs font-black uppercase tracking-widest">{selectedDrop.locationName}</p>
                </div>
                <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-emerald-100">Live Today</div>
              </div>
              
              <div className="flex gap-3">
                <button onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedDrop.locationName)}`)} className="flex-1 bg-slate-900 text-white py-4 rounded-3xl font-black flex items-center justify-center gap-2 text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all"><Navigation size={18}/> Navigation</button>
                <button onClick={()=>setShowPayment(true)} className="flex-1 bg-indigo-600 text-white py-4 rounded-3xl font-black flex items-center justify-center gap-2 text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 active:scale-95 transition-all"><QrCode size={18}/> Pay Now</button>
              </div>

              <div className="space-y-6">
                <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                    <h3 className="font-black text-sm uppercase text-slate-400 tracking-[0.2em]">The Menu</h3>
                    <span className="text-[10px] font-black bg-slate-100 px-3 py-1 rounded-full">{selectedDrop.menu?.length || 0} Items</span>
                </div>
                <div className="grid gap-4">
                  {selectedDrop.menu?.map((item, idx) => (
                    <div key={idx} onClick={() => setPreviewItem(item)} className="flex items-center gap-4 p-4 bg-white rounded-3xl cursor-pointer hover:border-indigo-100 border border-slate-50 shadow-sm transition-all group">
                      <div className="w-20 h-20 rounded-2xl bg-slate-100 overflow-hidden shrink-0 shadow-inner"><img src={item.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform" alt={item.name} /></div>
                      <div className="flex-1">
                          <p className="font-black text-slate-800 text-lg">{item.name}</p>
                          <p className="font-black text-indigo-600 mt-1">${item.price}</p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors"><ChevronRight size={18}/></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'post' && (
          <div className="p-8 space-y-8 animate-in slide-in-from-bottom pb-40">
            <div>
                <h2 className="text-4xl font-black italic tracking-tighter">Go Live</h2>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Ready to start selling?</p>
            </div>

            <div className="space-y-6">
              {/* Type Toggle */}
              <div className="flex gap-2 p-1.5 bg-slate-100 rounded-[24px]">
                <button onClick={() => setNewDrop({...newDrop, type:'static'})} className={`flex-1 py-4 rounded-[20px] text-[10px] font-black tracking-widest transition-all ${newDrop.type === 'static' ? 'bg-white shadow-xl text-indigo-600' : 'text-slate-400'}`}>POP-UP SHOP</button>
                <button onClick={() => setNewDrop({...newDrop, type:'food-truck'})} className={`flex-1 py-4 rounded-[20px] text-[10px] font-black tracking-widest transition-all ${newDrop.type === 'food-truck' ? 'bg-white shadow-xl text-amber-600' : 'text-slate-400'}`}>FOOD TRUCK</button>
              </div>

              {/* Reorganized Fields: Name & Zelle First */}
              <div className="space-y-4">
                 <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Identity</p>
                    <input value={newDrop.title} onChange={e=>setNewDrop({...newDrop, title: e.target.value})} placeholder="Store Name (e.g. ClaraNY)" className="w-full p-5 rounded-2xl border border-slate-200 bg-white outline-none font-bold focus:border-indigo-600 transition-colors" />
                    <input value={newDrop.zelleId} onChange={e=>setNewDrop({...newDrop, zelleId: e.target.value})} placeholder="Zelle Email or Phone Number" className="w-full p-5 rounded-2xl border border-slate-200 bg-white outline-none font-bold focus:border-indigo-600 transition-colors" />
                 </div>

                 <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Location & Schedule</p>
                    <input value={newDrop.locationName} onChange={e=>setNewDrop({...newDrop, locationName: e.target.value})} placeholder="Address (e.g. 123 Main St, NY)" className="w-full p-5 rounded-2xl border border-slate-200 bg-white outline-none text-sm font-bold" />
                    <div className="flex gap-2">
                        <input type="date" value={newDrop.eventDate} onChange={e=>setNewDrop({...newDrop, eventDate: e.target.value})} className="flex-1 p-5 rounded-2xl border border-slate-200 bg-white outline-none text-sm font-bold" />
                        <input value={newDrop.closesAt} onChange={e=>setNewDrop({...newDrop, closesAt: e.target.value})} placeholder="Until? (9PM)" className="w-32 p-5 rounded-2xl border border-slate-200 bg-white outline-none text-sm font-bold" />
                    </div>
                 </div>
              </div>

              {/* Visuals */}
              <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Store Front Photo</p>
                <label className="block w-full h-56 border-2 border-dashed rounded-[32px] flex flex-col items-center justify-center text-slate-400 border-slate-200 bg-white overflow-hidden active:bg-slate-50 transition-all cursor-pointer shadow-sm">
                    {newDrop.images.length > 0 ? <img src={newDrop.images[0]} className="w-full h-full object-cover" alt="preview" /> : <><Camera size={40} className="text-slate-200" /> <span className="text-[10px] font-black mt-4 uppercase tracking-[0.2em]">Upload Main Photo</span></>}
                    <input type="file" className="hidden" onChange={async (e) => { const url = await uploadToFirebase(e.target.files[0], 'drops'); setNewDrop({...newDrop, images: [url]}); }} />
                </label>
              </div>

              {/* Menu Building - Pro Cards */}
              <div className="p-6 bg-slate-900 rounded-[32px] space-y-6 shadow-2xl">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Build Menu Listing</p>
                <div className="flex gap-4">
                  <label className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center cursor-pointer border border-white/10 shrink-0">
                    {itemImageLoading ? <Loader2 className="w-6 h-6 animate-spin text-white"/> : menuItemInput.image ? <img src={menuItemInput.image} className="w-full h-full object-cover rounded-2xl" alt="item"/> : <Camera size={24} className="text-white/30"/>}
                    <input type="file" className="hidden" onChange={async (e) => { setItemImageLoading(true); try { const url = await uploadToFirebase(e.target.files[0], 'items'); setMenuItemInput({...menuItemInput, image: url}); } finally { setItemImageLoading(false); } }} />
                  </label>
                  <div className="flex-1 space-y-2">
                    <input value={menuItemInput.name} onChange={e=>setMenuItemInput({...menuItemInput, name: e.target.value})} placeholder="Item Name" className="w-full px-4 py-3 rounded-xl border-none text-sm outline-none bg-white/5 text-white font-bold" />
                    <input value={menuItemInput.price} onChange={e=>setMenuItemInput({...menuItemInput, price: e.target.value})} placeholder="Price $" className="w-full px-4 py-3 rounded-xl border-none text-sm outline-none bg-white/5 text-white font-bold" />
                  </div>
                </div>
                <button onClick={() => { if(menuItemInput.image && menuItemInput.name) { setNewDrop({...newDrop, menu: [...newDrop.menu, menuItemInput]}); setMenuItemInput({name:'', price:'', image:''}); } else { alert("Photo + Name required!"); } }} className="w-full py-4 bg-white text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest">Add Item to List</button>
                <div className="flex flex-wrap gap-2">
                   {newDrop.menu.map((m, i) => <div key={i} className="bg-white/10 text-white px-4 py-2 rounded-xl text-[10px] font-bold flex items-center gap-2">{m.name} <X size={12} className="cursor-pointer text-white/40" onClick={()=>setNewDrop({...newDrop, menu: newDrop.menu.filter((_, idx)=>idx!==i)})}/></div>)}
                </div>
              </div>

              <button onClick={handlePostDrop} disabled={isPosting} className="w-full bg-indigo-600 text-white py-7 rounded-[32px] font-black uppercase tracking-[0.2em] flex justify-center shadow-2xl shadow-indigo-200 active:scale-95 transition-all mb-10">{isPosting ? <Loader2 className="animate-spin"/> : 'Publish My Spot'}</button>
            </div>
          </div>
        )}

        {view === 'merchant-dash' && (
          <div className="p-8 space-y-8 pb-32">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-black italic tracking-tighter">{isAdmin ? "Admin Console" : "Merchant Hub"}</h2>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{user?.email}</p>
              </div>
              <button onClick={() => signOut(popAuth)} className="p-3 bg-red-50 text-red-500 rounded-2xl"><LogIn size={20}/></button>
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{isAdmin ? "Global Active Listings" : "Your Active Listings"}</p>
              {drops.filter(d => isAdmin ? true : d.merchantId === user?.uid).map(myDrop => (
                <div key={myDrop.id} className="bg-white p-6 rounded-[32px] border border-slate-100 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden"><img src={myDrop.images[0]} className="w-full h-full object-cover" /></div>
                      <div>
                        <span className="font-black text-lg block leading-none">{myDrop.title}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">{myDrop.locationName.split(',')[0]}</span>
                      </div>
                  </div>
                  <button onClick={async () => { if(confirm("Delete this listing permanently?")) await deleteDoc(doc(popDb, 'artifacts', APP_PATH, 'public', 'data', 'drops', myDrop.id)); }} className="p-3 bg-red-50 text-red-500 rounded-2xl"><Trash2 size={20}/></button>
                </div>
              ))}
              <button onClick={() => setView('post')} className="w-full py-6 border-2 border-dashed border-indigo-100 bg-indigo-50/20 rounded-[32px] text-indigo-600 font-black text-xs uppercase tracking-widest">+ CREATE NEW LISTING</button>
            </div>
          </div>
        )}
      </main>

      {/* NAVIGATION - Premium Floating Design */}
      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-slate-900/90 backdrop-blur-2xl rounded-[35px] py-4 px-10 flex justify-between items-center z-50 shadow-2xl border border-white/10">
        <button onClick={() => { setView('explore'); setDisplayMode('list'); }} className={view === 'explore' ? 'text-white' : 'text-white/30'}><Grid size={24}/></button>
        <button onClick={() => { if(!user) handleLogin(); else setView('post'); }} className="bg-indigo-600 text-white p-6 rounded-[30px] shadow-2xl shadow-indigo-500/40 -mt-16 active:scale-90 transition-transform"><Plus size={32}/></button>
        <button onClick={() => setView('merchant-dash')} className={view === 'merchant-dash' ? 'text-white' : 'text-white/30'}><User size={24}/></button>
      </nav>

      {/* MODAL: ITEM PREVIEW */}
      {previewItem && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in" onClick={() => setPreviewItem(null)}>
          <div className="bg-white rounded-[40px] overflow-hidden max-w-sm w-full shadow-2xl animate-in zoom-in-95" onClick={e=>e.stopPropagation()}>
            <div className="relative h-96">
               <img src={previewItem.image} className="w-full h-full object-cover" alt="item-preview" />
               <button onClick={()=>setPreviewItem(null)} className="absolute top-6 right-6 bg-black/20 backdrop-blur-md text-white p-3 rounded-full"><X size={20}/></button>
            </div>
            <div className="p-10 text-center">
              <h3 className="text-3xl font-black mb-2 italic tracking-tighter uppercase">{previewItem.name}</h3>
              <p className="text-indigo-600 font-black text-4xl mb-8">${previewItem.price}</p>
              <button onClick={()=>setPreviewItem(null)} className="w-full py-5 bg-slate-900 text-white rounded-[24px] font-black text-xs uppercase tracking-[0.2em]">Close Preview</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ZELLE PAY */}
      {showPayment && selectedDrop && (
        <div className="fixed inset-0 z-[110] bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in" onClick={()=>setShowPayment(false)}>
          <div className="bg-white p-10 rounded-[40px] text-center max-w-sm w-full shadow-2xl" onClick={(e)=>e.stopPropagation()}>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-8">Secure Zelle Payment</p>
            <div className="bg-slate-50 p-8 rounded-[32px] mb-8 border border-slate-100 shadow-inner">
              <img src={selectedDrop.zelleQR || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(selectedDrop.zelleId)}`} className="mx-auto rounded-2xl w-full aspect-square object-contain shadow-md mb-6" alt="QR" />
              <p className="font-black text-slate-900 select-all text-2xl tracking-tighter">{selectedDrop.zelleId}</p>
            </div>
            <button onClick={() => { navigator.clipboard.writeText(selectedDrop.zelleId); alert("Zelle ID Copied!"); }} className="w-full py-5 bg-indigo-600 text-white rounded-[24px] font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 mb-4 flex items-center justify-center gap-3"><CheckCircle2 size={18}/> Copy Zelle ID</button>
            <button onClick={()=>setShowPayment(false)} className="w-full py-5 bg-slate-100 text-slate-500 rounded-[24px] font-black text-xs uppercase tracking-widest">Return to Shop</button>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
