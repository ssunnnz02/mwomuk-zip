// ── 카카오 REST API 키 (발급 후 여기에 입력하세요) ──
const KAKAO_API_KEY = 'd2a099c4f0a3635ad82f97b58ae66031';

// ── 음식 종류 → 검색 키워드 매핑 ──
const FOOD_KEYWORDS = {
  korean:   '한식',
  japanese: '일식',
  chinese:  '중식',
  western:  '양식',
  bunsik:   '분식',
  chicken:  '치킨',
  fastfood: '패스트푸드',
  sandwich: '샌드위치',
pub:      '술집',
  cafe:     '카페'
};

// ── 조건 → 검색 키워드 매핑 ──
const CONDITION_KEYWORDS = {
  reservation: '예약',
  parking:     '주차',
  takeout:     '포장',
  room:        '룸',
  terrace:     '테라스',
  latenight:   '심야'
};

// ── 사용자 실제 위치 (버튼 클릭 시 설정됨) ──
let userLat = null, userLng = null;

// ── Haversine 거리 계산 (두 좌표 사이 실제 거리, 단위: m) ──
function calcDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2)**2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// ── 필터 상태 ──
const filterGroups = {
  type: 'all',
  foods: new Set(),
  conditions: new Set(),
  location: '',
  lat: null,
  lng: null,
  menuText: ''  // 직접 입력 메뉴명
};

// ── 자리 유형: 단일 선택 ──
const typeGroup = document.getElementById('filter-type');
typeGroup.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    typeGroup.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filterGroups.type = btn.dataset.value;
  });
});

// ── 메뉴: 복수 선택 ──
const foodGroup = document.getElementById('filter-food');
const foodAllBtn = foodGroup.querySelector('[data-value="all"]');

function clearMenuInput() {
  const el = document.getElementById('menu-input');
  el.value = '';
  filterGroups.menuText = '';
  el.classList.remove('has-text');
  foodGroup.classList.remove('dimmed');
}

foodGroup.querySelectorAll('.filter-btn.toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    clearMenuInput();
    const val = btn.dataset.value;
    if (filterGroups.foods.has(val)) {
      filterGroups.foods.delete(val);
      btn.classList.remove('active');
    } else {
      filterGroups.foods.add(val);
      btn.classList.add('active');
    }
    if (filterGroups.foods.size > 0) {
      foodAllBtn.classList.remove('active');
    } else {
      foodAllBtn.classList.add('active');
    }
  });
});
foodAllBtn.addEventListener('click', () => {
  clearMenuInput();
  filterGroups.foods.clear();
  foodGroup.querySelectorAll('.filter-btn.toggle').forEach(b => b.classList.remove('active'));
  foodAllBtn.classList.add('active');
});

// ── 직접 입력 메뉴명 ──
document.getElementById('menu-input').addEventListener('input', (e) => {
  const val = e.target.value.trim();
  filterGroups.menuText = val;
  if (val) {
    e.target.classList.add('has-text');
    foodGroup.classList.add('dimmed');
    // 카테고리 버튼 선택 해제
    filterGroups.foods.clear();
    foodGroup.querySelectorAll('.filter-btn.toggle').forEach(b => b.classList.remove('active'));
    foodAllBtn.classList.remove('active');
  } else {
    e.target.classList.remove('has-text');
    foodGroup.classList.remove('dimmed');
    foodAllBtn.classList.add('active');
  }
});

// ── 조건: 복수 선택 ──
document.getElementById('filter-condition').querySelectorAll('.filter-btn.toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const val = btn.dataset.value;
    if (filterGroups.conditions.has(val)) {
      filterGroups.conditions.delete(val);
      btn.classList.remove('active');
    } else {
      filterGroups.conditions.add(val);
      btn.classList.add('active');
    }
  });
});

// ── 현재 위치 버튼 ──
async function getLocationByIP() {
  // 1순위: ipinfo.io (CORS 완전 지원, 무료 월 5만회)
  try {
    const res = await fetch('https://ipinfo.io/json');
    const data = await res.json();
    if (data.loc) {
      const [lat, lng] = data.loc.split(',').map(Number);
      if (lat && lng) return { lat, lng };
    }
  } catch (e) {}
  // 2순위: ipapi.co
  try {
    const res = await fetch('https://ipapi.co/json/');
    const data = await res.json();
    if (data.latitude && data.longitude) {
      return { lat: data.latitude, lng: data.longitude };
    }
  } catch (e) {}
  // 3순위: freeipapi.com
  try {
    const res = await fetch('https://freeipapi.com/api/json');
    const data = await res.json();
    if (data.latitude && data.longitude) {
      return { lat: data.latitude, lng: data.longitude };
    }
  } catch (e) {}
  return null;
}

document.getElementById('location-btn').addEventListener('click', () => {
  const btn = document.getElementById('location-btn');
  btn.textContent = '📡 찾는 중...';
  btn.disabled = true;

  const applyLocation = (lat, lng, label) => {
    filterGroups.lat = lat;
    filterGroups.lng = lng;
    userLat = lat;
    userLng = lng;
    document.getElementById('location-input').value = '현재 위치';
    btn.textContent = label;
    btn.disabled = false;
  };

  const fallbackToIP = async () => {
    btn.textContent = '🌐 IP 위치 확인 중...';
    const pos = await getLocationByIP();
    if (pos) {
      // IP 좌표 → 카카오 역지오코딩 → 동네명으로 변환
      try {
        const rgRes = await fetch(
          `https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=${pos.lng}&y=${pos.lat}`,
          { headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` } }
        );
        const rgData = await rgRes.json();
        const region = rgData.documents?.[1] || rgData.documents?.[0];
        if (region) {
          const dong = region.region_3depth_name;
          const gu   = region.region_2depth_name;
          const neighborhood = dong || gu;
          const locationInput = document.getElementById('location-input');
          locationInput.value = neighborhood;
          filterGroups.location = neighborhood;
          filterGroups.lat = null;
          filterGroups.lng = null;
          userLat = null;
          userLng = null;
          btn.textContent = '📍 위치 감지됨 (부정확할 수 있어요)';
          btn.disabled = false;
          // 입력창 선택 → 바로 수정 가능
          locationInput.style.outline = '2px solid #ff8ae0';
          locationInput.style.transition = 'outline 0.4s';
          locationInput.focus();
          locationInput.select();
          setTimeout(() => { locationInput.style.outline = ''; }, 4000);
          return;
        }
      } catch (e) {}
      // 역지오코딩 실패 시 좌표 직접 사용
      applyLocation(pos.lat, pos.lng, '📍 위치 감지됨 ✓');
    } else {
      // 모든 방법 실패 → 위치 없이 전국 검색 가능하게
      btn.textContent = '🗺️ 현재 위치';
      btn.disabled = false;
      document.getElementById('location-input').value = '';
      filterGroups.lat = null;
      filterGroups.lng = null;
    }
  };

  if (!navigator.geolocation) {
    fallbackToIP();
    return;
  }

  // 1차 시도: 정밀도 낮게, 캐시 허용 (빠름)
  let resolved = false;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      resolved = true;
      applyLocation(pos.coords.latitude, pos.coords.longitude, '📍 현재 위치 ✓');
    },
    async (err) => {
      if (resolved) return;
      if (err.code === 1) {
        btn.textContent = '🗺️ 현재 위치';
        btn.disabled = false;
        alert('위치 권한이 차단되어 있어요.\n\n① 주소창 왼쪽 🔒 아이콘 → 위치 → 허용\n② 맥: 시스템 설정 → 개인정보 보호 및 보안 → 위치 서비스 → 브라우저 체크\n③ 새로고침 후 다시 시도!');
        return;
      }
      // 2차 시도: 정밀도 높게, 캐시 없이 재시도 (느리지만 더 정확)
      btn.textContent = '📡 재시도 중...';
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolved = true;
          applyLocation(pos.coords.latitude, pos.coords.longitude, '📍 현재 위치 ✓');
        },
        async () => {
          await fallbackToIP();
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
      );
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
  );
});

// ── 전체 초기화 버튼 ──
document.getElementById('reset-btn').addEventListener('click', () => {
  // filterGroups 초기화
  filterGroups.type = 'all';
  filterGroups.foods.clear();
  filterGroups.conditions.clear();
  filterGroups.location = '';
  filterGroups.lat = null;
  filterGroups.lng = null;
  filterGroups.menuText = '';
  userLat = null;
  userLng = null;

  // 직접 입력창 초기화
  const menuInput = document.getElementById('menu-input');
  menuInput.value = '';
  menuInput.classList.remove('has-text');
  foodGroup.classList.remove('dimmed');

  // 자리 버튼: 상관없음 active
  typeGroup.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  typeGroup.querySelector('[data-value="all"]').classList.add('active');

  // 메뉴·조건 버튼: 전체 해제
  document.getElementById('filter-food').querySelectorAll('.filter-btn').forEach(b => {
    b.classList.remove('active');
    if (b.dataset.value === 'all') b.classList.add('active');
  });
  document.getElementById('filter-condition').querySelectorAll('.filter-btn').forEach(b => {
    b.classList.remove('active');
  });

  // 위치 입력창 + 버튼 초기화
  document.getElementById('location-input').value = '';
  document.getElementById('location-btn').textContent = '🗺️ 현재 위치';

  // 결과 영역 초기화
  document.getElementById('results-list').innerHTML = '';
  document.getElementById('results-title').style.display = 'none';
  document.getElementById('random-btn').style.display = 'none';
  document.getElementById('condition-notice').style.display = 'none';
  document.getElementById('results-placeholder').style.display = 'block';
  document.getElementById('results-placeholder').querySelector('p').innerHTML =
    '필터를 선택하고<br><strong>맛집 찾기</strong>를 눌러보세요';
});

// ── 검색 버튼 ──
document.getElementById('search-btn').addEventListener('click', async () => {
  const locationText = document.getElementById('location-input').value.trim();

  setLoading(true);

  try {
    let lat = filterGroups.lat;
    let lng = filterGroups.lng;

    const isGpsSearch = (locationText === '현재 위치');

    // 텍스트 입력인 경우 좌표로 변환 (거리 표시용)
    if (locationText && !isGpsSearch) {
      const coords = await geocode(locationText);
      if (coords) { lat = coords.lat; lng = coords.lng; }
    }

    // GPS 검색 시 동네명 추출 (네이버 쿼리에 텍스트로 포함)
    let locationQueryText = '';
    if (locationText && !isGpsSearch) {
      locationQueryText = ` ${locationText}`;
    } else if (isGpsSearch && lat && lng) {
      try {
        const rgRes = await fetch(
          `https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=${lng}&y=${lat}`,
          { headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` } }
        );
        const rgData = await rgRes.json();
        const region = rgData.documents?.[1] || rgData.documents?.[0];
        if (region) {
          locationQueryText = ` ${region.region_3depth_name || region.region_2depth_name}`;
        }
      } catch (e) {}
    }

    // 검색 키워드 조합
    const foodKeys = [...filterGroups.foods];
    const queries = foodKeys.length > 0
      ? foodKeys.map(f => FOOD_KEYWORDS[f] || f)
      : ['맛집'];

    // 조건 키워드 조합
    const conditionSuffix = [...filterGroups.conditions]
      .filter(c => CONDITION_KEYWORDS[c])
      .map(c => CONDITION_KEYWORDS[c])
      .join(' ');

    // 중복 제거 헬퍼
    const dedupe = (arr) => {
      const seen = new Set();
      return arr.filter(p => {
        const key = p.place_name + p.road_address_name;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };

    // ── 3단계 폴백 검색 (네이버 API) ──
    async function smartFetch(baseKeyword) {
      const steps = [
        `${baseKeyword}${conditionSuffix ? ' ' + conditionSuffix : ''}${locationQueryText}`,
        `${baseKeyword}${locationQueryText}`,
        baseKeyword,
      ];
      for (const query of steps) {
        const result = await fetchPlacesNaver(query);
        if (result.length > 0) return result;
      }
      return [];
    }

    let places = [];
    if (filterGroups.menuText) {
      places = await smartFetch(filterGroups.menuText);
    } else {
      const results = await Promise.all(queries.map(kw => smartFetch(kw)));
      places = dedupe(results.flat());
    }

    showResults(places, lat, lng, conditionSuffix, [...filterGroups.conditions], isGpsSearch);
  } catch (e) {
    console.error(e);
    alert('검색 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.');
  } finally {
    setLoading(false);
  }
});

// ── 카카오 API: 텍스트 → 좌표 ──
async function geocode(query) {
  const res = await fetch(
    `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=1`,
    { headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` } }
  );
  const data = await res.json();
  if (data.documents?.length > 0) {
    return { lat: parseFloat(data.documents[0].y), lng: parseFloat(data.documents[0].x) };
  }
  return null;
}

// ── 네이버 API: 장소 검색 (서버 프록시 경유) ──
function naverToPlace(item) {
  const name = item.title.replace(/<\/?b>/g, '');
  // mapx/mapy: 네이버는 WGS84 × 10^7 정수
  const lng = parseInt(item.mapx) / 10000000;
  const lat = parseInt(item.mapy) / 10000000;
  const shortAddr = (item.roadAddress || item.address || '').split(' ').slice(0, 3).join(' ');
  const naverMapUrl = `https://map.naver.com/v5/search/${encodeURIComponent(name + ' ' + shortAddr)}`;
  const kakaoMapUrl = `https://map.kakao.com/?q=${encodeURIComponent(name)}`;
  return {
    id:               name + (item.roadAddress || item.address),
    place_name:       name,
    address_name:     item.address     || '',
    road_address_name: item.roadAddress || '',
    phone:            item.telephone   || '',
    place_url:        naverMapUrl,      // 네이버지도 검색 링크
    kakao_url:        kakaoMapUrl,      // 카카오맵 검색 링크
    category_name:    item.category    || '',
    x:                String(lng),
    y:                String(lat),
    distance:         '',
  };
}

async function fetchPlacesNaver(query) {
  // 네이버 지역검색: 한 번에 최대 5개, 4페이지 병렬 = 최대 20개
  const starts = [1, 6, 11, 16];
  const results = await Promise.all(
    starts.map(start =>
      fetch(`/api/search?${new URLSearchParams({ query, display: 5, start })}`)
        .then(r => r.json())
        .then(d => (d.items || []).map(naverToPlace))
        .catch(() => [])
    )
  );
  return results.flat();
}

// ── 로딩 상태 ──
function setLoading(on) {
  const btn = document.getElementById('search-btn');
  btn.textContent = on ? '🔍 검색 중...' : '🔍 맛집 찾기 ✦';
  btn.disabled = on;
}

// ── 결과 렌더링 ──
function showResults(places, lat, lng, conditionSuffix = '', selectedConditions = [], isGpsSearch = false) {
  const placeholder = document.getElementById('results-placeholder');
  const list = document.getElementById('results-list');
  const title = document.getElementById('results-title');

  // 검증 불가 조건 안내 배너
  const notice = document.getElementById('condition-notice');
  const unverifiable = { room: '🚪 룸 있음', terrace: '🌿 야외/테라스', latenight: '🌙 심야 영업' };
  const flagged = selectedConditions.filter(c => unverifiable[c]).map(c => unverifiable[c]);
  if (flagged.length > 0 && places.length > 0) {
    notice.innerHTML = `⚠️ <strong>${flagged.join(', ')}</strong> 조건은 키워드 검색 기반이라 실제 여부는 카카오맵·네이버지도에서 꼭 확인해주세요!`;
    notice.style.display = 'block';
  } else {
    notice.style.display = 'none';
  }

  placeholder.style.display = 'none';
  list.innerHTML = '';

  if (places.length === 0) {
    placeholder.style.display = 'block';
    placeholder.querySelector('p').innerHTML = '조건에 맞는 곳을 찾지 못했어요 😢<br>필터를 조정해보세요!';
    title.style.display = 'none';
    return;
  }

  title.style.display = 'block';
  title.textContent = `✨ 검색 결과 ${places.length}개`;

  // 랜덤 뽑기 버튼 표시
  const randomBtn = document.getElementById('random-btn');
  randomBtn.style.display = 'block';
  randomBtn.textContent = '🎲 랜덤 뽑기';

  // 거리 계산: GPS면 실제 내 위치 기준, 텍스트 입력이면 검색 중심 기준
  const refLat = (isGpsSearch && userLat) ? userLat : lat;
  const refLng = (isGpsSearch && userLng) ? userLng : lng;

  function formatDist(place) {
    if (!refLat || !refLng) return '';
    const placeLat = parseFloat(place.y);
    const placeLng = parseFloat(place.x);
    if (!placeLat || !placeLng) return '';
    const d = calcDistance(refLat, refLng, placeLat, placeLng);
    if (!d) return '';
    return d < 1000 ? `${d}m` : `${(d / 1000).toFixed(1)}km`;
  }

  // 카테고리로 이모지 매핑
  function categoryEmoji(categoryName) {
    if (categoryName.includes('카페') || categoryName.includes('디저트')) return '☕';
    if (categoryName.includes('일식') || categoryName.includes('스시') || categoryName.includes('라멘')) return '🍣';
    if (categoryName.includes('한식') || categoryName.includes('분식')) return '🍲';
    if (categoryName.includes('중식')) return '🥟';
    if (categoryName.includes('양식') || categoryName.includes('이탈리') || categoryName.includes('피자')) return '🍝';
    if (categoryName.includes('치킨') || categoryName.includes('버거')) return '🍗';
    if (categoryName.includes('고기') || categoryName.includes('삼겹') || categoryName.includes('구이')) return '🥩';
    return '🍽️';
  }

  places.forEach(place => {
    const card = document.createElement('div');
    card.className = 'result-card';

    const dist = formatDist(place);
    const emoji = categoryEmoji(place.category_name);
    const categoryShort = place.category_name.split(' > ').slice(-2).join(' · ');
    const address = place.road_address_name || place.address_name;


    card.innerHTML = `
      <div class="card-top">
        <span class="category">${categoryShort}</span>
        ${dist ? `<span class="dist-badge">📍 ${isGpsSearch ? '내 위치에서 ' : ''}${dist}</span>` : ''}
      </div>
      <div class="name">
        <span class="card-emoji">${emoji}</span> ${place.place_name}
      </div>
      <div class="address">🗺️ ${address}</div>
      ${place.phone ? `<div class="phone">📞 ${place.phone}</div>` : ''}
      <div class="tags"></div>
      <div class="card-links">
        <a class="map-link naver" href="${place.place_url}" target="_blank">🗺️ 네이버지도</a>
        <a class="map-link menu" href="${place.kakao_url}" target="_blank">🗺️ 카카오맵</a>
      </div>
    `;
    list.appendChild(card);
  });

  // 모바일: 결과 섹션으로 스크롤 / 데스크탑: 결과 패널 상단으로 스크롤
  const resultsSection = document.getElementById('results-section');
  if (window.innerWidth >= 1024) {
    resultsSection.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    resultsSection.scrollIntoView({ behavior: 'smooth' });
  }
}

// ── 랜덤 뽑기 ──
document.getElementById('random-btn').addEventListener('click', () => {
  const cards = Array.from(document.querySelectorAll('.result-card'));
  if (cards.length === 0) return;

  const btn = document.getElementById('random-btn');
  btn.disabled = true;
  btn.textContent = '🎲 뽑는 중...';

  // 이전 결과 초기화
  cards.forEach(c => c.classList.remove('roulette-winner', 'roulette-loser', 'roulette-flash'));

  const winnerIdx = Math.floor(Math.random() * cards.length);

  // ── 시간 예산 기반 계산 (항상 7초 이내) ──
  const BUDGET     = 6800;   // 총 애니메이션 예산 (ms)
  const FAST_MS    = 40;     // 빠른 구간 한 스텝 시간 (ms)
  const SLOW_N     = 12;     // 감속 스텝 수
  const SLOW_ALLOC = 2200;   // 감속 구간에 배정된 시간 (ms)
  const MAX_FAST   = Math.floor((BUDGET - SLOW_ALLOC) / FAST_MS); // 최대 빠른 스텝 수

  // winnerIdx에 정확히 착지하면서 MAX_FAST+SLOW_N 이하인 최대 totalSteps
  let totalSteps = winnerIdx + 1;
  while (totalSteps + cards.length <= MAX_FAST + SLOW_N) {
    totalSteps += cards.length;
  }

  const fastSteps  = Math.max(1, totalSteps - SLOW_N);
  const slowBudget = BUDGET - fastSteps * FAST_MS;
  const maxDelay   = Math.max(FAST_MS + 10, Math.round(2 * slowBudget / SLOW_N - FAST_MS));
  const slowDelays = Array.from({ length: SLOW_N }, (_, i) =>
    Math.round(FAST_MS + (i / (SLOW_N - 1)) * (maxDelay - FAST_MS))
  );

  let step = 0;
  function tick() {
    if (step > 0) cards[(step - 1) % cards.length].classList.remove('roulette-flash');
    const idx = step % cards.length;
    cards[idx].classList.add('roulette-flash');
    step++;
    if (step < totalSteps) {
      const delay = step < fastSteps ? FAST_MS : slowDelays[step - fastSteps];
      setTimeout(tick, delay);
    } else {
      // 최종 결과
      cards[winnerIdx].classList.remove('roulette-flash');
      cards[winnerIdx].classList.add('roulette-winner');
      cards.forEach((c, i) => { if (i !== winnerIdx) c.classList.add('roulette-loser'); });
      cards[winnerIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
      btn.disabled = false;
      btn.textContent = '🎲 다시 뽑기';
    }
  }

  setTimeout(tick, FAST_MS);
});

// ── 헤더 이모지 사이클 애니메이션 ──
const DECO_EMOJIS = [
  '🍜','🍣','🧁','🍝','☕','🥟','🍱','🥗','🍕','🍗',
  '🥩','🍰','🍙','🍛','🥘','🍤','🧆','🥙','🥞','🍢',
  '🍡','🧋','🍦','🥐','🍔','🌮','🍥','🥮','🍮','🫕'
];

function cycleHeaderEmojis() {
  const spans = Array.from(document.querySelectorAll('.header-deco-row span'));
  if (!spans.length) return;

  const STEP_DELAY  = 120;  // 이모지 하나씩 뿅뿅 간격 (ms)
  const CYCLE_PAUSE = 2000; // 한 바퀴 다 돌고 쉬는 시간 (ms)

  function popOne(span) {
    return new Promise(resolve => {
      let next;
      do { next = DECO_EMOJIS[Math.floor(Math.random() * DECO_EMOJIS.length)]; }
      while (next === span.textContent);

      span.style.transform = 'scale(0) rotate(90deg)';
      span.style.opacity   = '0';

      setTimeout(() => {
        span.textContent     = next;
        span.style.transform = 'scale(1.3) rotate(-10deg)';
        span.style.opacity   = '1';
        setTimeout(() => {
          span.style.transform = 'scale(1) rotate(0deg)';
          resolve();
        }, 160);
      }, 140);
    });
  }

  async function runCycle() {
    for (let i = 0; i < spans.length; i++) {
      popOne(spans[i]);
      await new Promise(r => setTimeout(r, STEP_DELAY));
    }
    // 한 바퀴 끝나면 잠깐 쉬고 다시
    setTimeout(runCycle, CYCLE_PAUSE);
  }

  // 페이지 로드 후 1.5초 뒤 시작
  setTimeout(runCycle, 1500);
}

cycleHeaderEmojis();
