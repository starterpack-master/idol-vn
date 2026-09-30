/**
 * Character definitions.
 * - art: procedural placeholder parameters; costumes: overrides per costume key ('casual', 'stage', ...)
 * - images / costumeImages: real standing art in public/chars/, e.g. images: { normal: 'chars/seoha_normal.png' }
 * Faces: normal, smile, laugh, smug, tease, surprised, shy, angry, sad
 */
export const characters = {
  seoha: {
    name: '한서하', stage: '하루', color: '#ff5c8a', height: 2.3,
    profile: '같은 반. 한별고 인기 1순위, 인스타 팔로워 2만. 처음부터 반말 명령조로 나를 조련한다. 가끔 0.5초 동안 전혀 다른 얼굴을 한다.',
    art: { style: 'side', hair: '#8a5a3c', hairDark: '#5e3a26', eye: '#b0673f', outfit: '#27304d', ribbon: '#e0435e', uniform: true, accessory: 'star' },
    costumes: { casual: { uniform: false, neck: 'hoodie', outfit: '#f5efe8', ribbon: '#ff8fb1' } },
    images: {},
  },
  chaei: {
    name: '윤채이', stage: '채채', color: '#ff9f43', height: 2.3,
    profile: '옆 반. 서하의 초등학교 때부터 짱친. 거리감이 고장 난 소악마. 사람 마음을 읽는 게 너무 쉬워서, 오히려 아무도 믿지 않는 것 같다.',
    art: { style: 'twin', hair: '#f4b3c2', hairDark: '#c77a8f', eye: '#e05c8a', outfit: '#27304d', ribbon: '#f08a24', uniform: true, accessory: 'ribbons' },
    costumes: { casual: { uniform: false, neck: 'tee', outfit: '#ffd166', ribbon: '#ff7a3d' } },
    images: {},
  },
  eunsol: {
    name: '백은솔', stage: '솔', color: '#6c8cff', height: 2.2,
    profile: '같은 반 창가 뒷자리. 말수는 거의 없지만 나만큼 서브컬처 덕후. 노래할 때만 스위치가 켜진다. 어째선지 내 덕질 이력을 너무 잘 안다.',
    art: { style: 'longBangs', hair: '#2b2d42', hairDark: '#1a1b2a', eye: '#7f8cff', outfit: '#27304d', ribbon: '#4a6cf0', uniform: true, headphones: true },
    costumes: { casual: { uniform: false, neck: 'hoodie', outfit: '#3b3f5c', ribbon: '#9fb1ff' } },
    images: {},
  },
  lilith: {
    name: '리리스', stage: '리리스', color: '#9b4dff', height: 2.35,
    profile: '라이벌 팀 「NOCTURNE//」 센터. 18세, 활동 2년 차. 상대가 원하는 말을 정확히 골라서 한다. 처음 본 나를 "운영"이라고 불렀다.',
    art: { style: 'long', hair: '#3a2447', hairDark: '#1f1227', eye: '#e0284f', outfit: '#1a1020', ribbon: '#111', uniform: false, accessory: 'horns' },
    costumes: { stage: { neck: 'stage', outfit: '#2a0f3f', ribbon: '#b06cff' } },
    images: {},
  },
  noct1: {
    name: 'NOCTURNE 멤버', color: '#6a3a9a', height: 2.2,
    art: { style: 'bob', hair: '#1c1c2a', hairDark: '#101018', eye: '#b06cff', outfit: '#2a0f3f', ribbon: '#6a3a9a', uniform: false, neck: 'stage', accessory: 'moon' },
    images: {},
  },
  noct2: {
    name: 'NOCTURNE 멤버', color: '#6a3a9a', height: 2.2,
    art: { style: 'twin', hair: '#d9d4e8', hairDark: '#9a92b8', eye: '#ff3d6e', outfit: '#2a0f3f', ribbon: '#ff3d6e', uniform: false, neck: 'stage' },
    images: {},
  },
  gom: {
    name: '곰사장', color: '#8d6e63', height: 2.5,
    art: { style: 'man', hair: '#3b2a2a', hairDark: '#4a3326', ribbon: '#6d1f1f', outfit: '#1b1b1f' },
    images: {},
  },
  stalker: { name: '???', color: '#444', height: 2.4, art: { style: 'stalker' }, images: {} },
  // voice-only extras
  girlA: { name: '반 여자애', color: '#999' },
  boyA: { name: '반 남자애', color: '#999' },
  fan: { name: '관객', color: '#777' },
};
