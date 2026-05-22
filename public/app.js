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

  if (!KAKAO_API_KEY) {
    alert('카카오 API 키를 app.js 파일에 입력해주세요!');
    return;
  }

  setLoading(true);

  try {
    let lat = filterGroups.lat;
    let lng = filterGroups.lng;

    // GPS 버튼으로 검색했는지 여부 (거리 표시 기준 결정)
    const isGpsSearch = (locationText === '현재 위치');

    // 텍스트 입력인 경우 좌표로 변환
    if (locationText && !isGpsSearch) {
      const coords = await geocode(locationText);
      if (!coords) {
        alert('위치를 찾지 못했어요. 다시 입력해보세요.');
        setLoading(false);
        return;
      }
      lat = coords.lat;
      lng = coords.lng;
    }

    // 검색 키워드 조합
    const foodKeys = [...filterGroups.foods];
    const queries = foodKeys.length > 0
      ? foodKeys.map(f => FOOD_KEYWORDS[f] || f)
      : ['맛집'];

    // 조건 키워드 조합 (예약, 주차, 룸, 테라스, 포장)
    const conditionSuffix = [...filterGroups.conditions]
      .filter(c => CONDITION_KEYWORDS[c])
      .map(c => CONDITION_KEYWORDS[c])
      .join(' ');

    // 카페 포함 여부에 따라 카테고리 코드 결정
    const isCafeOnly = foodKeys.length === 1 && foodKeys[0] === 'cafe';
    const hasCafe = foodKeys.includes('cafe');

    const locationSuffix = locationText && locationText !== '현재 위치' ? ` ${locationText}` : '';

    let places = [];

    // ── 3단계 폴백 검색 ──
    // 1단계: 음식종류 + 조건 + 위치
    // 2단계: 결과 없으면 조건 제거
    // 3단계: 그래도 없으면 '맛집'으로 폴백
    async function smartFetch(baseKeyword, category) {
      const steps = [
        `${baseKeyword}${conditionSuffix ? ' ' + conditionSuffix : ''}${locationSuffix}`,
        `${baseKeyword}${locationSuffix}`,
        baseKeyword,
      ];
      for (const query of steps) {
        const result = await fetchPlaces({ query, lat, lng, category });
        if (result.length > 0) return result;
      }
      return [];
    }

    // 중복 제거 헬퍼 (place id 기준)
    const dedupe = (arr) => [...new Map(arr.map(p => [p.id, p])).values()];

    if (filterGroups.menuText) {
      // 직접 입력: 카테고리 제한 없이 검색
      places = await smartFetch(filterGroups.menuText, null);
    } else if (isCafeOnly) {
      places = await smartFetch('카페', 'CE7');
    } else {
      const nonCafeKeywords = queries.filter(q => q !== '카페');
      const searchTargets = nonCafeKeywords.length > 0 ? nonCafeKeywords : ['맛집'];

      // 각 카테고리를 독립적으로 병렬 검색 후 합치기
      const results = await Promise.all(searchTargets.map(kw => smartFetch(kw, 'FD6')));
      places = dedupe(results.flat());

      if (hasCafe) {
        const cafes = await smartFetch('카페', 'CE7');
        places = dedupe([...places, ...cafes]);
      }
    }

    showResults(places, lat, lng, conditionSuffix, [...filterGroups.conditions], isGpsSearch);
  } catch (e) {
    console.error(e);
    alert('검색 중 오류가 발생했어요. API 키와 인터넷 연결을 확인해주세요.');
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

// ── 카카오 API: 장소 검색 ──
async function fetchPlaces({ query, lat, lng, category }) {
  const baseParams = { query, size: 15, sort: 'accuracy' };
  // 좌표가 있을 때만 위치 반경 적용, 없으면 전국 검색
  if (lat && lng) {
    baseParams.x = lng;
    baseParams.y = lat;
    baseParams.radius = 5000;
  }
  if (category) baseParams.category_group_code = category;

  const [res1, res2] = await Promise.all([
    fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?${new URLSearchParams({ ...baseParams, page: 1 })}`,
      { headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` } }
    ),
    fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?${new URLSearchParams({ ...baseParams, page: 2 })}`,
      { headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` } }
    )
  ]);
  const [data1, data2] = await Promise.all([res1.json(), res2.json()]);
  return [...(data1.documents || []), ...(data2.documents || [])];
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

  // 거리 계산:
  // GPS 검색 → 실제 내 위치(userLat/userLng) 기준 Haversine
  // 텍스트 검색 → 카카오 API가 반환한 place.distance (검색 중심 기준)
  const fromUser = isGpsSearch && !!(userLat && userLng);

  function formatDist(place) {
    let d;
    if (fromUser) {
      d = calcDistance(userLat, userLng, parseFloat(place.y), parseFloat(place.x));
    } else {
      d = parseInt(place.distance);
    }
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

    // 네이버 검색용: 지점명(~점, ~호점, ~본점) 제거 + 짧은 주소 추가
    const baseName = place.place_name
      .replace(/\s+[가-힣\d·\-]+[점호]$/, '')  // 논현본점, 강남점, 2호점 등 제거
      .replace(/\s+본점$/, '')                   // 독립된 '본점' 제거
      .trim() || place.place_name;
    const shortAddr = address.split(' ').slice(0, 3).join(' '); // 서울 강남구 논현로
    const naverQuery = encodeURIComponent(`${baseName} ${shortAddr}`);

    card.innerHTML = `
      <div class="card-top">
        <span class="category">${categoryShort}</span>
        ${dist ? `<span class="dist-badge">📍 ${fromUser ? '내 위치에서 ' : ''}${dist}</span>` : ''}
      </div>
      <div class="name">
        <span class="card-emoji">${emoji}</span> ${place.place_name}
      </div>
      <div class="address">🗺️ ${address}</div>
      ${place.phone ? `<div class="phone">📞 ${place.phone}</div>` : ''}
      <div class="tags"></div>
      <div class="card-links">
        <a class="map-link menu" href="${place.place_url}" target="_blank">🍽️ 메뉴·가격 보기</a>
        <a class="map-link naver" href="https://map.naver.com/v5/search/${naverQuery}" target="_blank">🗺️ 네이버지도</a>
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
