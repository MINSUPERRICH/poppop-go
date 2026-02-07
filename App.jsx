import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, onSnapshot, 
  query, serverTimestamp, doc, updateDoc, deleteDoc
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';
import { 
  getStorage, ref, uploadBytes, getDownloadURL 
} from 'firebase/storage';
import { 
  MapPin, User, ShoppingBag, QrCode, ChevronLeft, 
  Plus, X, Power, Shield, Map as MapIcon, Grid,
  ChevronRight, Loader2, Trash2, Navigation, 
  MessageSquare, Send, Bell, Search, Share2, 
  Instagram, Truck, Store, Zap, CheckCircle2, Ticket, Tag,
  Car, AlertCircle, Camera, Check, Info, Home, Copy, DollarSign, Image as ImageIcon, Link as LinkIcon
} from 'lucide-react';

// --- CONFIGURATION ---
const getFirebaseConfig = () => {
  // 1. Preview
  if (typeof __firebase_config !== 'undefined') {
    try { return JSON.parse(__firebase_config); } catch (e) { }
  }
  // 2. Production
  try {
    const env = import.meta.env || {};
    return {
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: env.VITE_FIREBASE_APP_ID
    };
  } catch (e) { return {}; }
};

const firebaseConfig = getFirebaseConfig();

// Initialize
let popApp, popAuth, popDb, popStorage;
if (firebaseConfig.apiKey) {
  try {
    popApp = initializeApp(firebaseConfig);
    popAuth = getAuth(popApp);
    popDb = getFirestore(popApp);
    popStorage = getStorage(popApp);
  } catch (e) { console.error("Init Error", e); }
}

const APP_PATH = "poppop-go-production";

const App = () => {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('explore'); 
  const [displayMode, setDisplayMode] = useState('list'); 
  const [drops, setDrops] = useState([]);
  const [orders, setOrders] = useState([]); 
  const [selectedShop, setSelectedShop] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  
  // States
  const [isUploading, setIsUploading] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Data States
  const [searchTerm, setSearchTerm] = useState("");
  const [msgInput, setMsgInput] = useState(""); 
  const [menuItemInput, setMenuItemInput] = useState({ name: '', price: '' });
  const [errorMsg, setErrorMsg] = useState(null);
  const [loyaltyUnlocked, setLoyaltyUnlocked] = useState(false);

  // Form State (Restored Zelle Link)
  const [newDrop, setNewDrop] = useState({
    title: '', locationName: '', zelleId: '', zelleQrUrl: '', zelleLink: '', images: [], status: 'live', type: 'static', hasCoupon: false, menu: [] 
  });

  // 1. Auth
  useEffect(() => {
    if (!popAuth) return;
    const tryLogin = async () => {
       if (!popAuth.currentUser) {
          try { 
             if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                await signInWithCustomToken(popAuth, __initial_auth_token);
             } else {
                await signInAnonymously(popAuth); 
             }
          } catch(e) { console.error("Auto-login failed", e); }
       }
    };
    tryLogin();
    return onAuthStateChanged(popAuth, setUser);
  }, []);

  // 2. Data Listeners
  useEffect(() => {
    if (!user || !popDb) return;
    
    // Drops
    const qDrops = query(collection(popDb, 'artifacts', APP_PATH, 'public', 'data', 'drops'));
    const uDrops = onSnapshot(qDrops, 
      (s) => setDrops(s.docs.map(d => ({id: d.id, ...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))),
      (e) => { if(e.code === 'permission-denied') setErrorMsg("DATABASE LOCKED: Check Rules"); }
    );
    
    // Orders
    const qOrders = query(collection(popDb, 'artifacts', APP_PATH, 'public', 'data', 'orders'));
    const uOrders = onSnapshot(qOrders, 
      (s) => setOrders(s.docs.map(d => ({id: d.id, ...d.data()})).sort((a,b)=>(b.timestamp?.seconds||0)-(a.timestamp?.seconds||0)))
    );
    return () => { uDrops(); uOrders(); };
  }, [user]);

  // --- LOGIC: Group Drops (Safe) ---
  const getUniqueShops = () => {
    const groups = {};
    drops.forEach(drop => {
      // Safety check
      if (!drop.merchantId) return; 

      if (!groups[drop.merchantId]) {
        groups[drop.merchantId] = {
          ...drop,
          // Ensure arrays exist
          allImages: drop.images ? [...drop.images] : [],
          allMenu: drop.menu ? [...drop.menu] : [],
          dropIds: [drop.id]
        };
      } else {
        const group = groups[drop.merchantId];
        // Merge arrays
        if (drop.images) group.allImages = [...group.allImages, ...drop.images];
        if (drop.menu) group.allMenu = [...group.allMenu, ...drop.menu];
        group.dropIds.push(drop.id);
      }
    });
    return Object.values(groups);
  };
  
  const uniqueShops = getUniqueShops();
  
  // Safe Filtering (Prevents crash on empty titles)
  const filteredShops = uniqueShops.filter(shop => {
    const term = searchTerm.toLowerCase();
    const t = (shop.title || "").toLowerCase();
    const l = (shop.locationName || "").toLowerCase();
    return t.includes(term) || l.includes(term);
  });

  // --- ACTIONS ---

  const goHome = () => {
    setView('explore');
    setDisplayMode('list');
    setSearchTerm("");
    setSelectedShop(null);
  };

  const handlePaymentNotify = async () => {
    try {
      await addDoc(collection(popDb, 'artifacts', APP_PATH, 'public', 'data', 'orders'), {
        merchantId: selectedShop.merchantId,
        shopTitle: selectedShop.title,
        buyerId: user.uid,
        status: 'pending',
        timestamp: serverTimestamp(),
        details: "Zelle Payment Reported"
      });
      setShowPayment(false);
      alert("Merchant Notified!");
    } catch (e) { alert("Error: " + e.message); }
  };

  const handleVerifyOrder = async (orderId) => {
    try {
      await updateDoc(doc(popDb, 'artifacts', APP_PATH, 'public', 'data', 'orders', orderId), { status: 'verified' });
    } catch (e) { alert("Only the merchant can verify this."); }
  };

  const deleteItemFromShop = async (dropId, itemIndex) => {
    const drop = drops.find(d => d.id === dropId);
    if (!drop) return;
    const newMenu = drop.menu ? drop.menu.filter((_, i) => i !== itemIndex) : [];
    await updateDoc(doc(popDb, 'artifacts', APP_PATH, 'public', 'data', 'drops', dropId), { menu: newMenu });
  };

  const handlePostDrop = async () => {
    if (!popDb || !user) { alert("System Offline. Refresh."); return; }
    if (newDrop.images.length === 0) { alert("Please add at least 1 item photo."); return; }

    setIsPosting(true);
    try {
      let lat = 40.7128; let lng = -74.0060; 
      try {
        const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, {timeout: 5000}));
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch (e) { console.log("GPS Defaulting"); }

      await addDoc(collection(popDb, 'artifacts', APP_PATH, 'public', 'data', 'drops'), {
        ...newDrop,
        merchantId: user.uid,
        lat, lng,
        createdAt: serverTimestamp(),
      });

      alert("Spot Published!");
      setView('explore');
      // Reset form
      setNewDrop({ title: newDrop.title, locationName: newDrop.locationName, zelleId: newDrop.zelleId, zelleQrUrl: newDrop.zelleQrUrl, zelleLink: '', images: [], status: 'live', type: 'static', hasCoupon: false, menu: [] });
    } catch (err) { alert("Error: " + err.message); } 
    finally { setIsPosting(false); }
  };

  const handleFileChange = async (e, type) => {
    const files = Array.from(e.target.files);
    if (!popStorage || files.length === 0) return;
    setIsUploading(true);
    try {
      for (let file of files) {
        const sRef = ref(popStorage, `artifacts/${APP_PATH}/drops/${Date.now()}_${file.name}`);
        const snap = await uploadBytes(sRef, file);
        const url = await getDownloadURL(snap.ref);
        
        if (type === 'zelle') {
           setNewDrop(prev => ({ ...prev, zelleQrUrl: url }));
        } else {
           setNewDrop(prev => ({ ...prev, images: [...prev.images, url].slice(0, 5) }));
        }
      }
    } catch (err) { alert("Upload Failed: " + err.message); }
    finally { setIsUploading(false); }
  };

  const openMaps = () => {
    if (!selectedShop) return;
    // Uses the Merchant's GPS
    window.open(`https://www.google.com/maps/search/?api=1&query=${selectedShop.lat},${selectedShop.lng}`, '_blank');
  };

  const openUber = () => {
    if (!selectedShop) return;
    const nick = encodeURIComponent(selectedShop.title);
    window.open(`https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=${selectedShop.lat}&dropoff[longitude]=${selectedShop.lng}&dropoff[nickname]=${nick}`, '_blank');
  };

  const shareToSocial = async () => {
    const txt = `Check out ${selectedShop.title} at ${selectedShop.locationName}! On PopPop Go.`;
    if (navigator.share) {
        navigator.share({ title: selectedShop.title, text: txt, url: window.location.href }).catch(console.error);
    } else {
        await navigator.clipboard.writeText(txt);
        alert("Link copied!");
    }
    if (selectedShop.hasCoupon) setLoyaltyUnlocked(true);
  };

  const handleSendMessage = async () => {
    if (!msgInput.trim()) return;
    try {
      await addDoc(collection(popDb, 'artifacts', APP_PATH, 'public', 'data', 'memos'), {
        merchantId: selectedShop.merchantId,
        dropTitle: selectedShop.title,
        text: msgInput,
        senderId: user.uid,
        createdAt: serverTimestamp()
      });
      alert("Message Sent to Merchant!");
      setMsgInput("");
    } catch (e) { alert("Send failed: " + e.message); }
  };

  // Map Component
  const MapView = () => {
    const mapRef = useRef(null);
    useEffect(() => {
      const loadMap = () => {
          if (!window.L) return;
          if (mapRef.current) return;
          
          const map = window.L.map('map-el', {zoomControl: false}).setView([40.7128, -74.0060], 13);
          mapRef.current = map;
          
          window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);
          
          // Use filteredShops (All Merchants)
          filteredShops.forEach(shop => {
             if (shop.lat) {
                 const marker = window.L.marker([shop.lat, shop.lng]).addTo(map);
                 marker.bindPopup(`<b>${shop.title}</b><br>${shop.locationName}`);
                 marker.on('click', () => { setSelectedShop(shop); setView('shop-detail'); });
             }
          });
          
          navigator.geolocation.getCurrentPosition(p => map.setView([p.coords.latitude, p.coords.longitude], 14));
      };
      
      if (!window.L) {
         const link = document.createElement('link'); link.rel = 'stylesheet'; link.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
         document.head.appendChild(link);
         const script = document.createElement('script'); script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
         script.onload = loadMap;
         document.head.appendChild(script);
      } else { loadMap(); }
    }, [filteredShops]);
    
    return <div id="map-el" className="h-[75vh] w-full rounded-2xl z-0 bg-slate-100 mt-4"></div>;
  };

  if (!firebaseConfig.apiKey) return <div className="p-10 text-center text-white bg-slate-900">Config Error</div>;

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans max-w-md mx-auto border-x border-slate-200 relative overflow-hidden text-slate-900">
      
      {errorMsg && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-8"><div className="bg-white p-6 rounded-2xl text-center"><p className="text-red-600 font-bold mb-4">{errorMsg}</p><button onClick={()=>setErrorMsg(null)} className="bg-black text-white px-6 py-2 rounded-xl">OK</button></div></div>}

      <header className="bg-white/95 backdrop-blur-md px-6 pt-12 pb-4 sticky top-0 z-30 border-b border-slate-100 flex justify-between items-center">
        <h1 className="text-2xl font-black text-indigo-600 italic tracking-tighter">PopPop Go</h1>
        <div className="flex gap-2">
          <button 
            onClick={() => {
               if (view === 'explore' && displayMode === 'list') { setDisplayMode('map'); } 
               else { goHome(); }
            }} 
            className={`w-10 h-10 rounded-2xl border flex items-center justify-center active:scale-90 transition-all ${displayMode==='map' && view==='explore' ? 'bg-indigo-600 text-white shadow-lg':'bg-white text-slate-600'}`}
          >
             {displayMode==='list' && view==='explore' ? <MapIcon className="w-5 h-5"/> : <Grid className="w-5 h-5"/>}
          </button>
          <button onClick={() => setView('merchant-dash')} className="w-10 h-10 rounded-2xl border bg-slate-50 flex items-center justify-center active:scale-90 transition-all relative"><User className="w-5 h-5 text-slate-400"/>
          {orders.filter(o => o.merchantId === user?.uid && o.status === 'pending').length > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto relative">
        {view === 'explore' && (
          <>
            <div className="p-4 sticky top-0 bg-slate-50/80 backdrop-blur-md z-20"><div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/><input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="Search Merchants..." className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-[24px] text-sm font-medium outline-none shadow-sm"/></div></div>
            {displayMode === 'list' ? (
              <div className="px-4 space-y-4 pb-32">
                {filteredShops.length === 0 && <div className="py-20 text-center text-slate-300 italic text-sm">No live shops...</div>}
                {filteredShops.map(shop => (
                  <div key={shop.id} onClick={() => { setSelectedShop(shop); setView('shop-detail'); }} className="bg-white rounded-[32px] overflow-hidden shadow-sm border border-slate-100 active:scale-[0.98] transition-transform">
                    <img src={shop.images?.[0] || shop.allImages?.[0]} className="h-64 w-full object-cover" />
                    <div className="p-5">
                      <div className="flex gap-1 mb-1">
                          {shop.type==='food-truck' && <span className="bg-amber-100 text-amber-600 text-[8px] font-black px-2 py-0.5 rounded-md">TRUCK</span>}
                          {shop.hasCoupon && <span className="bg-pink-100 text-pink-600 text-[8px] font-black px-2 py-0.5 rounded-md">10% OFF</span>}
                          {shop.allImages?.length > 1 && <span className="bg-slate-100 text-slate-500 text-[8px] font-black px-2 py-0.5 rounded-md">+{shop.allImages.length} ITEMS</span>}
                      </div>
                      <h3 className="font-bold text-lg">{shop.title}</h3>
                      <p className="text-xs text-slate-400 font-bold italic flex items-center gap-1"><MapPin className="w-3 h-3 text-red-500"/> {shop.locationName}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : <div className="px-4"><MapView /></div>}
          </>
        )}

        {view === 'shop-detail' && selectedShop && (
          <div className="pb-40 bg-white min-h-screen animate-in slide-in-from-right">
            <div className="relative h-80 flex overflow-x-auto snap-x scrollbar-hide bg-black">
              {selectedShop.allImages?.filter(Boolean).map((img, i) => <img key={i} src={img} className="w-full h-full object-contain snap-center shrink-0" />)}
              <button onClick={() => setView('explore')} className="absolute top-12 left-6 bg-white/90 p-3 rounded-full shadow-lg"><ChevronLeft /></button>
            </div>
            
            <div className="p-8 -mt-10 bg-white rounded-t-[48px] relative z-10 space-y-6 shadow-2xl">
              <div className="flex justify-between items-center"><h2 className="text-3xl font-black italic">{selectedShop.title}</h2><div className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-[10px] font-black">OPEN</div></div>
              <div className="flex gap-3">
                <button onClick={openMaps} className="flex-1 bg-slate-100 p-4 rounded-3xl flex flex-col items-center font-black text-xs"><Navigation className="w-6 h-6 mb-1"/>MAPS</button>
                <button onClick={openUber} className="flex-1 bg-black text-white p-4 rounded-3xl flex flex-col items-center font-black text-xs"><Car className="w-6 h-6 mb-1"/>UBER</button>
              </div>

              {selectedShop.hasCoupon && (
                <button onClick={shareToSocial} className="w-full bg-gradient-to-r from-pink-500 to-indigo-600 p-5 rounded-[32px] text-white flex justify-between items-center shadow-xl active:scale-95 transition-all">
                  <div className="flex items-center gap-3"><Share2 className="w-6 h-6"/><div className="text-left font-bold text-sm">Share for 10% OFF</div></div>
                  {loyaltyUnlocked ? <div className="bg-white/20 px-3 py-1 rounded-lg text-xs font-black">ANT10</div> : <Plus className="opacity-50"/>}
                </button>
              )}
              
              {!selectedShop.hasCoupon && (
                <button onClick={shareToSocial} className="w-full bg-slate-100 p-5 rounded-[32px] text-slate-800 flex justify-center items-center shadow-sm active:scale-95">
                  <div className="flex items-center gap-3"><Share2 className="w-5 h-5"/><span className="font-bold text-sm">Share this Spot</span></div>
                </button>
              )}

              <div className="bg-slate-900 p-6 rounded-[32px] flex justify-between items-center text-white active:bg-black shadow-xl" onClick={()=>setShowPayment(true)}>
                <div className="text-left"><p className="text-[10px] font-bold opacity-70 uppercase tracking-widest mb-1 italic">Zelle Pay</p><p className="font-bold text-lg underline decoration-indigo-400">{selectedShop.zelleId}</p></div>
                <div className="bg-white/10 p-3 rounded-2xl"><QrCode /></div>
              </div>

              <div className="space-y-2">
                 <h3 className="font-black text-xs uppercase tracking-widest text-slate-400">All Items</h3>
                 {selectedShop.allMenu?.map((m,i)=>(<div key={i} className="flex justify-between p-4 border rounded-2xl"><span className="font-bold">{m.name}</span><span className="text-indigo-600 font-black">${m.price}</span></div>))}
                 {selectedShop.allMenu?.length === 0 && <div className="p-4 text-center text-slate-300 text-xs italic">See photos above for inventory</div>}
              </div>
              
              <div className="pt-6 border-t border-slate-100 space-y-2">
                 <h3 className="font-black text-xs uppercase tracking-widest text-slate-400">Message Merchant</h3>
                 <div className="flex gap-2">
                    <input value={msgInput} onChange={e=>setMsgInput(e.target.value)} placeholder="Type a question..." className="flex-1 p-3 bg-slate-50 rounded-xl text-sm outline-none" />
                    <button onClick={handleSendMessage} className="bg-black text-white p-3 rounded-xl"><Send className="w-4 h-4"/></button>
                 </div>
              </div>
            </div>
          </div>
        )}

        {view === 'post' && (
          <div className="p-8 space-y-6 pb-40 animate-in slide-in-from-bottom font-sans">
            <div className="flex justify-between items-center"><h2 className="text-3xl font-black italic">Add Item</h2><button onClick={()=>setView('explore')}><X/></button></div>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                 {newDrop.images.map((img, i) => (<div key={i} className="aspect-square rounded-2xl overflow-hidden relative border border-slate-100 shadow-inner"><img src={img} className="w-full h-full object-cover" /><Check className="absolute bottom-1 right-1 w-4 h-4 bg-indigo-600 text-white rounded-full p-0.5"/></div>))}
                 {newDrop.images.length < 5 && (
                   <label className="aspect-square rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 cursor-pointer active:bg-slate-200">
                      {isUploading ? <Loader2 className="animate-spin" /> : <Camera className="w-8 h-8" />}
                      <span className="text-[8px] font-black mt-1 uppercase">{isUploading ? 'Loading...' : 'Photo'}</span>
                      <input type="file" accept="image/*" capture="environment" onChange={(e)=>handleFileChange(e, 'item')} className="hidden" disabled={isUploading} />
                   </label>
                 )}
              </div>
              
              {/* ZELLE QR SECTION */}
              <div className="p-4 bg-indigo-50 rounded-2xl border-2 border-dashed border-indigo-200 space-y-3">
                 <p className="text-[10px] font-black text-indigo-400 uppercase">Zelle Payment Setup (Optional)</p>
                 
                 {/* Option 1: Paste Link */}
                 <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-indigo-100">
                    <LinkIcon className="w-4 h-4 text-indigo-300"/>
                    <input 
                      value={newDrop.zelleLink} 
                      onChange={e=>setNewDrop({...newDrop, zelleLink:e.target.value})} 
                      placeholder="Paste Share Link from Bank App..." 
                      className="flex-1 text-xs outline-none font-medium"
                    />
                 </div>

                 {/* Option 2: Upload Screenshot */}
                 {newDrop.zelleQrUrl ? (
                   <div className="flex items-center gap-2 text-green-600 font-bold text-xs"><CheckCircle2 className="w-4 h-4" /> QR Image Uploaded</div>
                 ) : (
                   <label className="flex items-center justify-center gap-2 bg-white py-2 rounded-xl border border-indigo-100 text-indigo-600 font-bold text-xs cursor-pointer shadow-sm">
                      <ImageIcon className="w-4 h-4" /> Upload QR Screenshot
                      <input type="file" accept="image/*" onChange={(e)=>handleFileChange(e, 'zelle')} className="hidden" />
                   </label>
                 )}
              </div>

              <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl mb-4">
                <button type="button" onClick={() => setNewDrop({...newDrop, type: 'static'})} className={`flex-1 py-3 rounded-xl text-[10px] font-black ${newDrop.type === 'static' ? 'bg-white shadow' : 'text-slate-400'}`}><Store className="w-4 h-4" /> POP-UP</button>
                <button type="button" onClick={() => setNewDrop({...newDrop, type: 'food-truck'})} className={`flex-1 py-3 rounded-xl text-[10px] font-black ${newDrop.type === 'food-truck' ? 'bg-white shadow' : 'text-slate-400'}`}><Truck className="w-4 h-4" /> TRUCK</button>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                 <span className="text-sm font-bold text-slate-700">Offer 10% Discount?</span>
                 <button onClick={() => setNewDrop({...newDrop, hasCoupon: !newDrop.hasCoupon})} className={`w-12 h-6 rounded-full relative transition-colors ${newDrop.hasCoupon ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${newDrop.hasCoupon ? 'left-7' : 'left-1'}`}></div>
                 </button>
              </div>

              <div className="space-y-4">
                 <input required value={newDrop.title} onChange={e=>setNewDrop({...newDrop, title:e.target.value})} placeholder="Store Name" className="w-full p-4 rounded-2xl border border-slate-200 font-bold outline-none" />
                 <input required value={newDrop.locationName} onChange={e=>setNewDrop({...newDrop, locationName:e.target.value})} placeholder="Full Address (For Uber/Maps)" className="w-full p-4 rounded-2xl border border-slate-200 font-bold outline-none" />
                 <input required value={newDrop.zelleId} onChange={e=>setNewDrop({...newDrop, zelleId:e.target.value})} placeholder="Zelle ID (Email/Phone)" className="w-full p-4 rounded-2xl border border-slate-200 font-bold outline-none" />
              </div>

              <div className="p-5 bg-white border border-slate-100 rounded-3xl space-y-3 shadow-sm">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Tag className="w-3 h-3"/> Items</p>
                 <div className="flex gap-2">
                    <input value={menuItemInput.name} onChange={e=>setMenuItemInput({...menuItemInput, name: e.target.value})} placeholder="Item Name" className="flex-1 p-3 rounded-xl border border-slate-100 text-xs font-bold outline-none" />
                    <input value={menuItemInput.price} onChange={e=>setMenuItemInput({...menuItemInput, price: e.target.value})} placeholder="$" className="w-16 p-3 rounded-xl border border-slate-100 text-xs font-bold text-center outline-none" />
                    <button type="button" onClick={() => { if(menuItemInput.name) { setNewDrop({...newDrop, menu: [...newDrop.menu, {...menuItemInput}]}); setMenuItemInput({name:'', price:''}); } }} className="bg-indigo-600 text-white px-3 rounded-xl"><Plus className="w-4 h-4" /></button>
                 </div>
                 <div className="flex flex-wrap gap-2">{newDrop.menu.map((item, idx) => (<span key={idx} className="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase">{item.name} ${item.price}</span>))}</div>
              </div>
              
              <button 
                onClick={handlePostDrop} 
                disabled={isUploading || isPosting}
                className="w-full bg-indigo-600 text-white py-5 rounded-[28px] font-black shadow-xl uppercase tracking-widest text-xs active:scale-95 transition-all disabled:bg-slate-300 shadow-indigo-200"
              >
                {isPosting ? 'SAVING...' : isUploading ? 'UPLOADING...' : 'ADD TO SHOP'}
              </button>
            </div>
          </div>
        )}

        {view === 'merchant-dash' && (
          <div className="p-8 space-y-8 pb-40">
            <h2 className="text-3xl font-black italic tracking-tighter">My Hub</h2>
            <div className="space-y-4">
              <h3 className="font-black text-[10px] uppercase text-slate-400 tracking-widest">Customer Payments</h3>
              {orders.filter(o => o.merchantId === user?.uid).length === 0 ? <div className="text-center text-slate-300 italic text-sm">No new orders</div> : 
                 orders.filter(o => o.merchantId === user?.uid).map(order => (
                    <div key={order.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                       <div className="flex justify-between items-center mb-2">
                          <span className="font-bold text-sm">Payment Claim</span>
                          <span className={`text-[10px] px-2 py-1 rounded-full font-black ${order.status === 'verified' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>{order.status.toUpperCase()}</span>
                       </div>
                       <p className="text-xs text-slate-500 mb-3">{order.details}</p>
                       {order.status !== 'verified' && <button className="w-full bg-green-500 text-white py-2 rounded-xl text-xs font-bold" onClick={() => handleVerifyOrder(order.id)}>Confirm Received</button>}
                    </div>
                 ))
              }
            </div>

            <div className="space-y-4 pt-6 border-t border-slate-100">
               <h3 className="font-black text-[10px] uppercase text-slate-400 tracking-widest">Active Items</h3>
               {drops.filter(d => d.merchantId === user?.uid).map(myDrop => (
                 <div key={myDrop.id} className="bg-white p-5 rounded-[32px] border border-slate-200 shadow-sm">
                   <div className="flex gap-3 items-center mb-3">
                     <img src={myDrop.images?.[0]} className="w-12 h-12 rounded-xl object-cover" />
                     <div className="flex-1">
                       <span className="font-bold block text-sm">{myDrop.title}</span>
                       <button className="text-red-400 text-xs font-bold" onClick={() => deleteDoc(doc(popDb, 'artifacts', APP_PATH, 'public', 'data', 'drops', myDrop.id))}>Delete Spot</button>
                     </div>
                   </div>
                   {/* Item Delete List */}
                   <div className="space-y-1">
                     {myDrop.menu?.map((item, idx) => (
                       <div key={idx} className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded-lg">
                         <span>{item.name}</span>
                         <X className="w-4 h-4 text-slate-300 cursor-pointer" onClick={() => deleteItemFromShop(myDrop.id, idx)} />
                       </div>
                     ))}
                   </div>
                 </div>
               ))}
               <button onClick={() => setView('post')} className="w-full bg-slate-900 text-white py-5 rounded-[28px] font-black shadow-xl text-xs uppercase">+ ADD NEW ITEM</button>
            </div>
            
            <div className="space-y-4 pt-6 border-t border-slate-100">
              <h3 className="font-black text-[10px] uppercase text-slate-400 tracking-widest">Inbox</h3>
              {memos.length === 0 ? <div className="text-center text-slate-300 italic text-sm">No messages.</div> : memos.map(m => (
                <div key={m.id} className="bg-white p-4 rounded-2xl border border-slate-100 relative"><p className="text-xs font-bold text-indigo-500 mb-1">{m.dropTitle}</p><p className="text-sm font-medium">{m.text}</p></div>
              ))}
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-white/80 backdrop-blur-xl border border-white/40 shadow-2xl rounded-[32px] py-4 px-10 flex justify-between items-center z-40">
        <button onClick={goHome} className={view==='explore'?'text-indigo-600':'text-slate-300'}><Home/></button>
        <button onClick={() => setView('post')} className="bg-indigo-600 text-white p-5 rounded-[24px] shadow-lg -mt-16 active:scale-90 transition-transform"><Plus className="w-7 h-7"/></button>
        <button onClick={() => setView('merchant-dash')} className={view==='merchant-dash'?'text-indigo-600':'text-slate-300'}><User/></button>
      </nav>

      {showPayment && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-8">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl animate-in zoom-in">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <DollarSign className="w-8 h-8 text-indigo-600" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">Scan to Pay</h3>
            
            {/* Logic: Show Link QR, Image, or Default */}
            {selectedShop?.zelleLink ? (
               <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(selectedShop.zelleLink)}`} className="mx-auto mb-4 rounded-xl border-2 border-indigo-100" />
            ) : selectedShop?.zelleQrUrl ? (
               <img src={selectedShop.zelleQrUrl} className="w-48 h-48 mx-auto mb-4 rounded-lg shadow-md border-2 border-slate-100" />
            ) : (
               <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(selectedShop?.zelleId || "Zelle")}`} className="mx-auto mb-4 rounded-xl opacity-50" />
            )}

            <div onClick={() => { navigator.clipboard.writeText(selectedShop.zelleId); alert("ID Copied!"); }} className="bg-slate-100 p-4 rounded-2xl border border-slate-200 mb-2 flex items-center justify-between cursor-pointer active:bg-slate-200">
              <span className="font-black text-lg text-indigo-600 truncate">{selectedShop?.zelleId}</span>
              <span className="text-xs font-bold text-slate-400 bg-white px-2 py-1 rounded-md shadow-sm">COPY</span>
            </div>
            
            <button onClick={handlePaymentNotify} className="w-full bg-green-500 text-white py-4 rounded-2xl font-black text-sm shadow-lg shadow-green-200 active:scale-95 transition-transform mt-4">DONE PAYING MERCHANT</button>
            <button onClick={() => setShowPayment(false)} className="mt-4 text-slate-400 text-xs font-bold w-full py-2">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
