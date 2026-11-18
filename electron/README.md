# Multi-Agent AI Browser Studio (Electron)

API anahtarı gerektirmeden Gemini, Claude, ChatGPT ve DeepSeek web arayüzlerini tek bir masaüstü stüdyosunda sırayla çalıştıran Electron uygulaması.

## Kurulum ve İlk Çalıştırma

```bash
cd electron
npm install
npm start
```

## İlk Kullanım Adımları

1. Uygulama açıldığında orta paneldeki **1. Mimar (Gemini)**, **2. Denetçi (Claude)** ve **3. Başmühendis (ChatGPT)** sekmelerine bir kez giriş yapın. Oturumlar `partition="persist:agent_session"` altında kalıcı olarak saklanır.
2. Sol panelden **Klasör Seç** ile yerel proje dizininizi bağlayın.
3. **Proje Fikri ve Ana Görev** alanını doldurun, **Otomatik (4sn)** veya **Manuel Onay** modunu seçip **Süreci Başlat** butonuna basın.
4. Sağ paneldeki **Önizle ve Uygula** butonuyla çıkarılan kod bloklarını fark önizlemesi ve otomatik `.bak` yedeğiyle dosyalarınıza yazın.
5. Herhangi bir yapay zekâ sitesinin arayüzü değişirse üst çubuktaki **Seçicileri Düzenle** butonuyla `selectors.json` dosyasını canlı olarak güncelleyin.
