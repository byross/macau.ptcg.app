const { createApp } = Vue;

createApp({
  data() {
    const today = new Date();
    const in30days = new Date(Date.now() + 30 * 86400000);
    return {
      events: [],
      jsonEvents: [],
      loading: false,
      startDate: today.toISOString().split('T')[0],
      endDate: in30days.toISOString().split('T')[0],
      weekDays: ['一', '二', '三', '四', '五', '六', '日'],
      organizerColors: {},
    };
  },
  computed: {
    calendarWeeks() {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const byDate = {};
      this.events.forEach(e => {
        const id = `${e.date}-${e.title}-${e.organizer}`;
        e.scrollId = id;
        if (!byDate[e.date]) byDate[e.date] = [];
        byDate[e.date].push(e);
      });

      const weeks = [];
      const firstDate = new Date(this.startDate);
      firstDate.setDate(firstDate.getDate() - ((firstDate.getDay() + 6) % 7));

      for (let w = 0; w < 6; w++) {
        const week = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(firstDate);
          d.setDate(firstDate.getDate() + w * 7 + i);
          const dateStr = d.toISOString().split('T')[0];
          week.push({
            day: d.getDate(),
            dateStr,
            isToday: dateStr === todayStr,
            events: (byDate[dateStr] || []).sort((a, b) => a.time.localeCompare(b.time))
          });
        }
        weeks.push(week);
      }
      return weeks;
    },
    flatDays() {
      return this.calendarWeeks.flat();
    },
    formattedStart() {
      return this.startDate.replace(/-/g, '/');
    },
    formattedEnd() {
      return this.endDate.replace(/-/g, '/');
    }
  },
  methods: {
    updateServiceWorkerIfNewAvailable() {
      if (!('serviceWorker' in navigator)) return;

      navigator.serviceWorker.getRegistration().then(reg => {
        if (!reg) return;

        reg.update();

        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                window.location.reload();
              }
            });
          }
        });
      });
    },
    getColorForDate(date) {
      const fixedColors = [
        "#FF6F61", "#4A90E2", "#FFD166", "#2ECC71", "#9B59B6",
        "#E74C3C", "#1ABC9C", "#F1C40F", "#34495E", "#EC407A"
      ];
      let hash = 0;
      for (let i = 0; i < date.length; i++) {
        hash = date.charCodeAt(i) + ((hash << 5) - hash);
      }
      const index = Math.abs(hash) % fixedColors.length;
      return fixedColors[index];
    },
    scrollTo(dateStr) {
      if (!dateStr) return;
      const e = this.events.find(e => e.date === dateStr);
      if (e) {
        const target = document.getElementById(e.scrollId);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    async fetchPage(page = 1) {
      const [sy, sm, sd] = this.startDate.split('-');
      const [ey, em, ed] = this.endDate.split('-');
      const startStr = `${sm}-${sd}-${sy}`;
      const endStr = `${em}-${ed}-${ey}`;

      const url = `https://get.byross-tech.workers.dev/?url=${encodeURIComponent(
        `https://asia.pokemon-card.com/hk/event-search/search/?pageNo=${page}&startDate=${startStr}&endDate=${endStr}&product[0]=20&product[1]=21&product[2]=22&product[3]=23`
      )}`;

      try {
        const res = await fetch(url);
        const html = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const list = doc.querySelectorAll('ul.eventList a.eventLink');
        
        console.log(`第 ${page} 頁找到 ${list.length} 個活動連結`);
        
        if (!list.length) return false;

        let newEventsCount = 0;
        let duplicateCount = 0;
        let filteredCount = 0;
        
        list.forEach((a, index) => {
          const li = a.querySelector('li.event');
          const code = a.getAttribute('href')?.match(/event-search\/(\d+)/)?.[1] || '';

          const rawDate = li.querySelector('time.eventDate')?.textContent.trim();
          const [mm, dd] = rawDate.split('-');
          const yyyy = new Date().getFullYear();
          const dateObj = new Date(`${yyyy}-${mm}-${dd}T12:00:00`);
          const date = dateObj.toISOString().split('T')[0];

          const time = li.querySelector('p.eventTime')?.textContent.trim();
          const title = li.querySelector('p.eventTitle')?.textContent.trim();
          const place = li.querySelector('p.place')?.textContent.trim();
          const organizer = li.querySelector('p.organizer')?.textContent.trim();

          const lowerFields = `${place || ''} ${organizer || ''}`.toLowerCase();

          if (lowerFields.includes('澳門') || lowerFields.includes('噶地利亞街') || lowerFields.includes('祐漢新村')) {
            // 檢查是否已經存在相同的活動
            const eventKey = `${title}-${date}-${time || ''}-${organizer}`;
            const isDuplicate = this.events.some(existingEvent => 
              `${existingEvent.title}-${existingEvent.date}-${existingEvent.time || ''}-${existingEvent.organizer}` === eventKey
            );
            
            if (!isDuplicate) {
              if (!this.organizerColors[organizer]) {
                const allOrganizers = Object.keys(this.organizerColors).sort();
                const index = allOrganizers.indexOf(organizer);
                const fixedColors = [
                  "#FF6F61", "#4A90E2", "#FFD166", "#2ECC71", "#9B59B6",
                  "#E74C3C", "#1ABC9C", "#F1C40F", "#34495E", "#EC407A"
                ];
                const nextIndex = Object.keys(this.organizerColors).length % fixedColors.length;
                this.organizerColors[organizer] = fixedColors[nextIndex];
              }
              this.events.push({ date, time, title, place, organizer, code });
              newEventsCount++;
              
              // 特別記錄「童趣同樂」相關活動
              if (title.includes('童趣') || title.includes('同樂')) {
                console.log(`新增童趣同樂活動 [第${page}頁第${index+1}個]:`, { title, date, time, organizer, place });
              }
            } else {
              duplicateCount++;
              console.log(`跳過重複活動 [第${page}頁第${index+1}個]:`, title, date, time, organizer);
            }
          } else {
            filteredCount++;
          }
        });

        console.log(`第 ${page} 頁: 新增 ${newEventsCount} 個, 重複 ${duplicateCount} 個, 過濾 ${filteredCount} 個`);
        return true;
      } catch (e) {
        console.error('錯誤：', e);
        return false;
      }
    },
    async fetchAllPages() {
      this.events = [];
      this.loading = true;
      
      // 讀取 JSON 文件中的活動
      await this.loadJsonEvents();
      
      // 讀取官方網站的活動
      let page = 1;
      while (await this.fetchPage(page)) page++;
      
      // 合併所有活動並排序
      this.mergeAndSortEvents();
      
      this.loading = false;
    },
    async loadJsonEvents() {
      try {
        const response = await fetch('events.json');
        if (response.ok) {
          this.jsonEvents = await response.json();
          console.log('JSON 活動載入成功:', this.jsonEvents.length, '個活動');
        }
      } catch (error) {
        console.error('載入 JSON 活動失敗:', error);
        this.jsonEvents = [];
      }
    },
    
    mergeAndSortEvents() {
      // 合併官方活動和 JSON 活動
      const allEvents = [...this.events, ...this.jsonEvents];
      
      // 去重邏輯：使用標題、日期和時間來識別重複活動
      const uniqueEvents = [];
      const seenEvents = new Set();
      
      allEvents.forEach(event => {
        // 創建唯一標識符：標題 + 日期 + 時間 + 主辦方
        const eventKey = `${event.title}-${event.date}-${event.time || ''}-${event.organizer}`;
        
        if (!seenEvents.has(eventKey)) {
          seenEvents.add(eventKey);
          uniqueEvents.push(event);
        } else {
          console.log('發現重複活動，已過濾:', event.title, event.date, event.time, event.organizer);
        }
      });
      
      // 按日期和時間排序
      uniqueEvents.sort((a, b) => {
        if (a.date !== b.date) {
          return a.date.localeCompare(b.date);
        }
        return (a.time || '').localeCompare(b.time || '');
      });
      
      this.events = uniqueEvents;
      console.log(`去重後共有 ${uniqueEvents.length} 個活動`);
    },
    
    search() {
      this.updateServiceWorkerIfNewAvailable();
      this.fetchAllPages();
    },
    weekdayChar(dateStr) {
      const days = ['日','一','二','三','四','五','六'];
      const d = new Date(dateStr);
      return days[d.getDay()];
    },
    rowBgClass(index, event) {
      const prev = this.events[index - 1];
      const even = index % 2 === 0;
      return prev && prev.date !== event.date ? 'row-start' : even ? 'row-even' : 'row-odd';
    }
  },
  mounted() {
    this.fetchAllPages();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    }
  }
}).mount('#app');