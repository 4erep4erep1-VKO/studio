'use client';

import React, { useState, useEffect } from 'react';
import { Calculator, X, Plus } from 'lucide-react';

const defaultPrices = {
  'Баннер литой': 1500,
  'Баннер ламинированный': 1200,
  'Пленка матовая/глянцевая': 1800,
  'Пленка с ламинацией': 2500,
  'ПВХ 3мм с накаткой': 6000,
};

export default function CalculatorWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'calc' | 'settings'>('calc');
  const [prices, setPrices] = useState<Record<string, number>>(defaultPrices);
  
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState(Object.keys(defaultPrices)[0]);

  const [newMatName, setNewMatName] = useState('');
  const [newMatPrice, setNewMatPrice] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('montazhka_prices');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPrices(parsed);
        setSelectedMaterial(Object.keys(parsed)[0]);
      } catch (e) {
        console.error('Ошибка загрузки цен', e);
      }
    }
  }, []);

  const updatePrices = (newPrices: Record<string, number>) => {
    setPrices(newPrices);
    localStorage.setItem('montazhka_prices', JSON.stringify(newPrices));
  };

  const handlePriceChange = (mat: string, val: string) => {
    const num = parseFloat(val) || 0;
    updatePrices({ ...prices, [mat]: num });
  };

  const deleteMaterial = (mat: string) => {
    const copy = { ...prices };
    delete copy[mat];
    updatePrices(copy);
    if (selectedMaterial === mat) {
      setSelectedMaterial(Object.keys(copy)[0] || '');
    }
  };

  const addMaterial = () => {
    if (!newMatName.trim() || !newMatPrice) return;
    const priceNum = parseFloat(newMatPrice) || 0;
    updatePrices({ ...prices, [newMatName.trim()]: priceNum });
    setNewMatName('');
    setNewMatPrice('');
  };

  // Пересчет из мм в метры: (мм * мм) / 1 000 000 = м²
  const w = parseFloat(width) || 0;
  const h = parseFloat(height) || 0;
  const area = (w * h) / 1000000;
  const pricePerSq = prices[selectedMaterial] || 0;
  const total = area * pricePerSq;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-200 ring-4 ring-primary/20 z-40"
        title="Калькулятор"
        aria-label="Открыть калькулятор"
      >
        <Calculator className="w-6 h-6" />
      </button>

      <div 
        className={`fixed top-0 right-0 h-full w-80 bg-card border-l border-border shadow-2xl z-50 transform transition-transform duration-300 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
          <h2 className="font-bold text-lg text-foreground flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" />
            Калькулятор
          </h2>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition"
            aria-label="Закрыть калькулятор"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex border-b border-border">
          <button 
            type="button"
            className={`flex-1 py-3 text-sm font-bold uppercase transition ${activeTab === 'calc' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            onClick={() => setActiveTab('calc')}
          >
            Расчет
          </button>
          <button 
            type="button"
            className={`flex-1 py-3 text-sm font-bold uppercase transition ${activeTab === 'settings' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            onClick={() => setActiveTab('settings')}
          >
            Настройки
          </button>
        </div>

        <div className="p-4 flex-grow overflow-y-auto custom-scrollbar">
          {activeTab === 'calc' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Ширина (мм)</label>
                  <input type="number" className="w-full h-10 px-3 bg-background text-foreground border border-border rounded focus:border-primary outline-none transition" value={width} onChange={e => setWidth(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Высота (мм)</label>
                  <input type="number" className="w-full h-10 px-3 bg-background text-foreground border border-border rounded focus:border-primary outline-none transition" value={height} onChange={e => setHeight(e.target.value)} placeholder="0" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Материал</label>
                <select 
                  className="w-full h-10 px-3 bg-background text-foreground border border-border rounded focus:border-primary outline-none transition"
                  value={selectedMaterial}
                  onChange={e => setSelectedMaterial(e.target.value)}
                >
                  {Object.keys(prices).map(mat => (
                    <option key={mat} value={mat}>{mat} ({prices[mat]} ₸/м²)</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 border-t border-border mt-4">
                <div className="flex justify-between text-sm text-muted-foreground mb-1">
                  <span>Площадь:</span>
                  <span>{area > 0 ? area.toFixed(2) : '0'} м²</span>
                </div>
                <div className="flex justify-between items-end">
                  <span className="font-bold text-foreground">ИТОГО:</span>
                  <span className="text-2xl font-black text-primary">{total > 0 ? total.toLocaleString('ru-RU') : '0'} ₸</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Цены за м² (₸)</label>
              
              {Object.entries(prices).map(([mat, price]) => (
                <div key={mat} className="flex gap-2 items-center">
                  <input type="text" readOnly value={mat} className="flex-grow h-9 px-2.5 bg-muted text-muted-foreground text-xs border border-border rounded truncate" title={mat} />
                  <input type="number" value={price} onChange={e => handlePriceChange(mat, e.target.value)} className="w-24 h-9 px-2 bg-background text-foreground text-xs border border-border rounded text-center focus:border-primary outline-none" />
                  <button type="button" onClick={() => deleteMaterial(mat)} className="h-9 w-9 shrink-0 inline-flex items-center justify-center text-destructive hover:bg-destructive/10 rounded transition" title="Удалить" aria-label={`Удалить ${mat}`}><X className="w-4 h-4" /></button>
                </div>
              ))}

              <div className="pt-4 border-t border-border mt-4">
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Добавить материал</label>
                <div className="flex gap-2 flex-col">
                  <input type="text" placeholder="Название" value={newMatName} onChange={e => setNewMatName(e.target.value)} className="w-full h-10 px-3 bg-background text-foreground border border-border rounded text-sm outline-none focus:border-primary" />
                  <div className="flex gap-2">
                    <input type="number" placeholder="Цена за м²" value={newMatPrice} onChange={e => setNewMatPrice(e.target.value)} className="w-full h-10 px-3 bg-background text-foreground border border-border rounded text-sm outline-none focus:border-primary" />
                    <button type="button" onClick={addMaterial} className="h-10 w-10 shrink-0 inline-flex items-center justify-center bg-primary text-primary-foreground font-bold rounded hover:bg-primary/90 active:scale-95 transition" title="Добавить" aria-label="Добавить материал"><Plus className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}