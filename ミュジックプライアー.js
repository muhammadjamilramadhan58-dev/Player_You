document.addEventListener('DOMContentLoaded', () => {
  // State Application
  let playlist = [];
  let shuffledPlaylist = []; 
  let currentTrackIndex = -1;
  let lyricsData = []; 
  let syncQueue = [];  
  
  // Mode States: 0 = Off, 1 = Repeat All, 2 = Repeat One
  let repeatMode = 0; 
  let isShuffled = false;

  // DOM Elements
  const audio = document.getElementById('audioEngine');
  const filePicker = document.getElementById('filePicker');
  const folderPicker = document.getElementById('folderPicker');
  const lrcFilePicker = document.getElementById('lrcFilePicker');
  const playlistItems = document.getElementById('playlistItems');
  const playlistCount = document.getElementById('playlistCount');
  
  const queueList = document.getElementById('queueList');
  const queueCount = document.getElementById('queueCount');

  // Player Elements
  const btnPlayPause = document.getElementById('btnPlayPause');
  const btnPrev = document.getElementById('btnPrev');
  const btnNext = document.getElementById('btnNext');
  const btnShuffle = document.getElementById('btnShuffle');
  const btnRepeat = document.getElementById('btnRepeat');
  const progressBar = document.getElementById('progressBar');
  const progressContainer = document.getElementById('progressContainer');
  const timeDisplay = document.getElementById('timeDisplay');
  const volumeRange = document.getElementById('volumeRange');

  // Text Elements
  const trackTitle = document.getElementById('trackTitle');
  const trackArtist = document.getElementById('trackArtist');
  const miniTitle = document.getElementById('miniTitle');
  const miniArtist = document.getElementById('miniArtist');
  const lyricsContainer = document.getElementById('lyricsContainer');

  // Synchronizer Elements
  const rawLyricsInput = document.getElementById('rawLyricsInput');
  const btnPrepareSync = document.getElementById('btnPrepareSync');
  const btnTapSync = document.getElementById('btnTapSync');
  const currentSyncLine = document.getElementById('currentSyncLine');
  const nextSyncLine = document.getElementById('nextSyncLine');
  const btnResetSync = document.getElementById('btnResetSync');
  const btnUndoSync = document.getElementById('btnUndoSync');
  const btnExportLrc = document.getElementById('btnExportLrc');
  const btnExportJson = document.getElementById('btnExportJson');

  // Audio Visualizer Setup
  const canvas = document.getElementById('visualizerCanvas');
  const ctx = canvas.getContext('2d');
  let audioCtx, analyser, source;

  function initVisualizer() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    source = audioCtx.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    analyser.fftSize = 64;
    drawVisualizer();
  }

  function drawVisualizer() {
    requestAnimationFrame(drawVisualizer);
    if (!analyser) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const barWidth = (canvas.width / bufferLength) * 2;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * canvas.height * 0.4;
      ctx.fillStyle = `rgba(30, 215, 96, ${dataArray[i] / 255 * 0.6})`;
      ctx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);
      x += barWidth;
    }
  }

  // --- TAB NAVIGATION ---
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  // --- FILE SCANNING & SELECTION ---
  filePicker.addEventListener('change', (e) => handleFileSelection(e.target.files));
  folderPicker.addEventListener('change', (e) => handleFileSelection(e.target.files));

  function handleFileSelection(files) {
    const audioFiles = Array.from(files).filter(f => f.type.startsWith('audio/') || f.name.match(/\.(mp3|wav|ogg|m4a|flac)$/i));
    if (audioFiles.length === 0) return;

    playlist = audioFiles.map(file => ({
      name: file.name.replace(/\.[^/.]+$/, ""),
      artist: "File Lokal",
      url: URL.createObjectURL(file),
      file: file
    }));

    buildShuffledPlaylist();
    renderPlaylist();
    renderQueue();
    loadTrack(0);
  }

  function buildShuffledPlaylist() {
    shuffledPlaylist = [...Array(playlist.length).keys()];
    if (isShuffled) {
      for (let i = shuffledPlaylist.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledPlaylist[i], shuffledPlaylist[j]] = [shuffledPlaylist[j], shuffledPlaylist[i]];
      }
    }
  }

  function renderPlaylist() {
    playlistCount.textContent = `${playlist.length} Lagu`;
    playlistItems.innerHTML = '';
    playlist.forEach((track, index) => {
      const item = document.createElement('div');
      item.className = `playlist-item ${index === currentTrackIndex ? 'active' : ''}`;
      item.innerHTML = `
        <div class="item-info">
          <div class="item-name">${index + 1}. ${track.name}</div>
          <div class="mini-artist">${track.artist}</div>
        </div>
        <i class="fa-solid ${index === currentTrackIndex ? 'fa-volume-high' : 'fa-play'}"></i>
      `;
      item.addEventListener('click', () => {
        currentTrackIndex = index;
        loadTrack(currentTrackIndex);
      });
      playlistItems.appendChild(item);
    });
  }

  function renderQueue() {
    queueCount.textContent = playlist.length;
    queueList.innerHTML = '';
    if (playlist.length === 0) {
      queueList.innerHTML = '<div class="queue-empty">Antrian kosong</div>';
      return;
    }

    playlist.forEach((track, index) => {
      const qItem = document.createElement('div');
      qItem.className = `queue-item ${index === currentTrackIndex ? 'active' : ''}`;
      qItem.innerHTML = `
        <span class="q-index">${index + 1}</span>
        <span class="q-name">${track.name}</span>
      `;
      qItem.addEventListener('click', () => {
        currentTrackIndex = index;
        loadTrack(currentTrackIndex);
      });
      queueList.appendChild(qItem);
    });
  }

  // --- PLAYBACK CONTROLS ---
  function loadTrack(index) {
    if (index < 0 || index >= playlist.length) return;
    currentTrackIndex = index;
    const track = playlist[currentTrackIndex];
    audio.src = track.url;

    trackTitle.textContent = track.name;
    miniTitle.textContent = track.name;
    trackArtist.textContent = track.artist;
    miniArtist.textContent = track.artist;

    renderPlaylist();
    renderQueue();
    
    audio.play().then(() => {
      trackTitle.classList.add('animate-marquee');
      miniTitle.classList.add('animate-marquee');
    });

    btnPlayPause.innerHTML = '<i class="fa-solid fa-pause"></i>';
    initVisualizer();
  }

  btnPlayPause.addEventListener('click', () => {
    if (!audio.src) return;
    if (audio.paused) {
      audio.play();
      btnPlayPause.innerHTML = '<i class="fa-solid fa-pause"></i>';
      trackTitle.classList.add('animate-marquee');
      miniTitle.classList.add('animate-marquee');
    } else {
      audio.pause();
      btnPlayPause.innerHTML = '<i class="fa-solid fa-play"></i>';
      trackTitle.classList.remove('animate-marquee');
      miniTitle.classList.remove('animate-marquee');
    }
  });

  audio.addEventListener('play', () => {
    trackTitle.classList.add('animate-marquee');
    miniTitle.classList.add('animate-marquee');
  });

  audio.addEventListener('pause', () => {
    trackTitle.classList.remove('animate-marquee');
    miniTitle.classList.remove('animate-marquee');
  });

  audio.addEventListener('ended', () => {
    trackTitle.classList.remove('animate-marquee');
    miniTitle.classList.remove('animate-marquee');
    
    if (repeatMode === 2) {
      audio.currentTime = 0;
      audio.play();
    } else if (repeatMode === 1 || currentTrackIndex < playlist.length - 1) {
      btnNext.click();
    } else {
      btnPlayPause.innerHTML = '<i class="fa-solid fa-play"></i>';
    }
  });

  btnNext.addEventListener('click', () => {
    if (playlist.length === 0) return;
    if (isShuffled) {
      let currentShufflePos = shuffledPlaylist.indexOf(currentTrackIndex);
      currentShufflePos = (currentShufflePos + 1) % shuffledPlaylist.length;
      loadTrack(shuffledPlaylist[currentShufflePos]);
    } else {
      loadTrack((currentTrackIndex + 1) % playlist.length);
    }
  });

  btnPrev.addEventListener('click', () => {
    if (playlist.length === 0) return;
    if (isShuffled) {
      let currentShufflePos = shuffledPlaylist.indexOf(currentTrackIndex);
      currentShufflePos = (currentShufflePos - 1 + shuffledPlaylist.length) % shuffledPlaylist.length;
      loadTrack(shuffledPlaylist[currentShufflePos]);
    } else {
      loadTrack((currentTrackIndex - 1 + playlist.length) % playlist.length);
    }
  });

  btnShuffle.addEventListener('click', () => {
    isShuffled = !isShuffled;
    btnShuffle.classList.toggle('active', isShuffled);
    buildShuffledPlaylist();
  });

  btnRepeat.addEventListener('click', () => {
    repeatMode = (repeatMode + 1) % 3;
    btnRepeat.classList.remove('active', 'repeat-one');
    
    if (repeatMode === 1) {
      btnRepeat.classList.add('active'); 
      btnRepeat.title = "Ulangi: Semua Lagu";
    } else if (repeatMode === 2) {
      btnRepeat.classList.add('active', 'repeat-one'); 
      btnRepeat.title = "Ulangi: Lagu Ini Saja";
    } else {
      btnRepeat.title = "Ulangi: Mati";
    }
  });

  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    const progress = (audio.currentTime / audio.duration) * 100;
    progressBar.style.width = `${progress}%`;
    timeDisplay.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;

    updateActiveLyric(audio.currentTime);
  });

  progressContainer.addEventListener('click', (e) => {
    if (!audio.duration) return;
    const width = progressContainer.clientWidth;
    const clickX = e.offsetX;
    audio.currentTime = (clickX / width) * audio.duration;
  });

  volumeRange.addEventListener('input', (e) => {
    audio.volume = e.target.value;
  });

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  // --- SINKRONISASI LIRIK SEKALI KETUK ---
  btnPrepareSync.addEventListener('click', () => {
    const lines = rawLyricsInput.value.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return alert('Silakan masukkan lirik terlebih dahulu.');

    syncQueue = [...lines];
    lyricsData = [];
    btnTapSync.disabled = false;
    updateSyncDisplay();
  });

  function updateSyncDisplay() {
    if (syncQueue.length > 0) {
      currentSyncLine.textContent = syncQueue[0];
      nextSyncLine.textContent = `Baris berikutnya: ${syncQueue[1] || '-'}`;
    } else {
      currentSyncLine.textContent = 'Semua baris telah tersinkronkan!';
      nextSyncLine.textContent = 'Silakan ekspor lirik Anda.';
      btnTapSync.disabled = true;
    }
  }

  function recordTapSync() {
    if (syncQueue.length === 0 || !audio.src) return;
    const time = audio.currentTime;
    const text = syncQueue.shift();

    lyricsData.push({ time, text });
    updateSyncDisplay();
    renderLyricsView();
  }

  btnTapSync.addEventListener('click', recordTapSync);

  window.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT') return;
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      recordTapSync();
    }
  });

  btnResetSync.addEventListener('click', () => {
    btnPrepareSync.click();
  });

  btnUndoSync.addEventListener('click', () => {
    if (lyricsData.length === 0) return;
    const last = lyricsData.pop();
    syncQueue.unshift(last.text);
    btnTapSync.disabled = false;
    updateSyncDisplay();
    renderLyricsView();
  });

  function renderLyricsView() {
    if (lyricsData.length === 0) {
      lyricsContainer.innerHTML = `
        <div class="lyrics-empty">
          <i class="fa-solid fa-quote-left"></i>
          <p>Belum ada lirik tersinkron.</p>
        </div>`;
      return;
    }

    lyricsContainer.innerHTML = '';
    lyricsData.forEach((item, index) => {
      const lineEl = document.createElement('div');
      lineEl.className = 'lyric-line';
      lineEl.dataset.index = index;
      lineEl.textContent = item.text;
      lineEl.addEventListener('click', () => {
        audio.currentTime = item.time;
      });
      lyricsContainer.appendChild(lineEl);
    });
  }

  function updateActiveLyric(currentTime) {
    if (lyricsData.length === 0) return;

    let activeIndex = -1;
    for (let i = 0; i < lyricsData.length; i++) {
      if (currentTime >= lyricsData[i].time) {
        activeIndex = i;
      } else {
        break;
      }
    }

    const lines = lyricsContainer.querySelectorAll('.lyric-line');
    lines.forEach((line, idx) => {
      if (idx === activeIndex) {
        if (!line.classList.contains('active')) {
          line.classList.add('active');
          line.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else {
        line.classList.remove('active');
      }
    });
  }

  lrcFilePicker.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      parseLRC(event.target.result);
    };
    reader.readAsText(file);
  });

  function parseLRC(lrcText) {
    const lines = lrcText.split('\n');
    const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;
    lyricsData = [];

    lines.forEach(line => {
      const match = line.match(regex);
      if (match) {
        const min = parseInt(match[1]);
        const sec = parseInt(match[2]);
        const ms = parseInt(match[3].padEnd(3, '0'));
        const time = min * 60 + sec + ms / 1000;
        const text = match[4].trim();
        if (text) lyricsData.push({ time, text });
      }
    });

    lyricsData.sort((a, b) => a.time - b.time);
    renderLyricsView();
  }

  btnExportLrc.addEventListener('click', () => {
    if (lyricsData.length === 0) return alert('Tidak ada lirik tersinkron untuk diekspor.');
    let lrcContent = '';
    lyricsData.forEach(item => {
      const m = Math.floor(item.time / 60).toString().padStart(2, '0');
      const s = Math.floor(item.time % 60).toString().padStart(2, '0');
      const ms = Math.floor((item.time % 1) * 100).toString().padStart(2, '0');
      lrcContent += `[${m}:${s}.${ms}]${item.text}\n`;
    });

    downloadFile(lrcContent, `${playlist[currentTrackIndex]?.name || 'lirik'}.lrc`, 'text/plain');
  });

  btnExportJson.addEventListener('click', () => {
    if (lyricsData.length === 0) return alert('Tidak ada lirik tersinkron untuk diekspor.');
    const packageData = {
      title: playlist[currentTrackIndex]?.name || "Unknown",
      artist: playlist[currentTrackIndex]?.artist || "Unknown",
      lyrics: lyricsData
    };

    downloadFile(JSON.stringify(packageData, null, 2), `${packageData.title}_paket.json`, 'application/json');
  });

  function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }
});