(function initApartmentStore(globalFactory) {
  const api = globalFactory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.SDLV_APARTMENT_STORE = api;
  }
}(function buildApartmentStore() {
  const customApartmentSource = typeof require === 'function'
    ? require('./apartment-custom-data')
    : (globalThis.SDLV_CUSTOM_APARTMENTS || {});
  const bookingQrCode = 'https://static.sdlvhk.com/图片素材/other/Image%202.6%20Contact%20Us/WImage%202.6%20學生居社.webp';
  const customApartmentsStorageKey = 'sdlv_custom_apartment_pages';

  const apartmentPages = {
    'apartment-ymt': {
      pageKey: 'apartment-ymt',
      slug: 'apartments/ymt',
      titleKey: 'apt_ymt_card_title',
      displayName: '汇生会社(油麻地)',
      meta: {
        sc: { title: '汇生会社（油麻地） | 汇生会 SDLV', description: '查看汇生会社油麻地学生公寓的户型、配套与环境。' },
        tc: { title: '滙生会社（油麻地） | 滙生會 SDLV', description: '查看滙生会社油麻地學生公寓的戶型、配套與環境。' },
        en: { title: 'Yau Ma Tei Residence | SDLV', description: 'Explore SDLV Yau Ma Tei student accommodation, room layout, amenities, and environment.' }
      },
      hero: {
        badge: 'Premium Residence',
        locationLine: '居社地理位置：香港油麻地吴松街1号',
        mapImage: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（油麻地）/油麻地地图_结果.webp',
        showInteractiveMap: true
      },
      transport: {
        sectionTitle: '交通出行',
        sectionSubtitle: '周边大学通勤时间 / 主要交通节点',
        cards: [
          {
            accent: 'navy',
            icon: 'train',
            title: '周边大学及通勤时长',
            items: [
              '香港理工大学：步行 15 分钟',
              '香港都会大学：巴士 20 分钟',
              '香港城市大学：地铁 25 分钟',
              '香港浸会大学：地铁 25 分钟',
              '香港大学：地铁 25 分钟'
            ]
          },
          {
            accent: 'red',
            icon: 'map-pin',
            title: '主要交通节点',
            items: [
              '油麻地地铁站：步行 3 分钟',
              '佐敦地铁站：步行 5 分钟',
              '柯士甸地铁站：步行 5 分钟',
              '西九龙站巴士总站：步行 10 分钟',
              '西九龙高铁站：巴士 20 分钟'
            ]
          }
        ]
      },
      rooms: {
        sectionTitle: '我们的房间',
        sectionSubtitle: '软硬件设施一览 / 实景相册',
        publicAreaHeading: '公共区域',
        photos: [
          { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（油麻地）/油麻地公寓照片/1号房/1号房_结果.webp', label: '1号房', alt: '1号房' },
          { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（油麻地）/油麻地公寓照片/2号房/2号房_结果.webp', label: '2号房', alt: '2号房' },
          { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（油麻地）/油麻地公寓照片/2号房/2号房%2002_结果.webp', label: '2号房', alt: '2号房' },
          { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（油麻地）/油麻地公寓照片/3号房/3号房_结果.webp', label: '3号房', alt: '3号房' },
          { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（油麻地）/油麻地公寓照片/3号房/3号房%2002_结果.webp', label: '3号房', alt: '3号房' },
          { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（油麻地）/油麻地公寓照片/4号房/4号房_结果.webp', label: '4号房', alt: '4号房' },
          { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（油麻地）/油麻地公寓照片/4号房/4号房%2002_结果.webp', label: '4号房', alt: '4号房' },
          { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（油麻地）/油麻地公寓照片/5号房/5号房_结果.webp', label: '5号房', alt: '5号房' },
          { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（油麻地）/油麻地公寓照片/5号房/5号房%2002_结果.webp', label: '5号房', alt: '5号房' },
          { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（油麻地）/油麻地公寓照片/6号房/6号房_结果.webp', label: '6号房', alt: '6号房' },
          { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（油麻地）/油麻地公寓照片/6号房/6号房%2002_结果.webp', label: '6号房', alt: '6号房' },
          { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（油麻地）/油麻地公寓照片/6号房/6号房%2003_结果.webp', label: '6号房', alt: '6号房' },
          { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（油麻地）/油麻地公寓照片/7号房/7号房_结果.webp', label: '7号房', alt: '7号房' },
          { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（油麻地）/油麻地公寓照片/8号房/8号房%2002_结果.webp', label: '8号房', alt: '8号房' },
          { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（油麻地）/油麻地公寓照片/8号房/8号房_结果.webp', label: '8号房', alt: '8号房' },
          { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（油麻地）/油麻地公寓照片/公共区域/厨房_结果.webp', label: '公共区域', alt: '公共区域 厨房' },
          { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（油麻地）/油麻地公寓照片/公共区域/电梯_结果.webp', label: '公共区域', alt: '公共区域 电梯' },
          { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（油麻地）/油麻地公寓照片/公共区域/洗衣区_结果.webp', label: '公共区域', alt: '公共区域 洗衣区' },
          { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（油麻地）/油麻地公寓照片/公共区域/走廊_结果.webp', label: '公共区域', alt: '公共区域 走廊' }
        ]
      },
      booking: {
        enabled: true,
        ctaText: '抢先以早鸟价格订房',
        modalTitle: '立即预定',
        modalDescription: '请扫描下方二维码，联系专属顾问获取早鸟报价',
        qrCode: bookingQrCode,
        excludeLabels: ['公共区域']
      },
      lifestyleCards: [
        { icon: 'shopping-bag', accent: 'red', title: '美食购物（5-20 分钟）', items: ['庙街夜市 / 旺角朗豪坊', '圆方商场 / 信和中心', '西洋菜南街 / 荷里活商业中心', '百老汇电影中心'] },
        { icon: 'store', accent: 'navy', title: '生活日用（1-5 分钟）', items: ['711 便利店', '惠康超市 / 百佳超市', '油麻地果栏'] },
        { icon: 'building-2', accent: 'slate', title: '公共设施（5-15 分钟）', items: ['油麻地警署', '九龙公园 / 京士柏公园', '伊利沙伯医院'] }
      ],
      amenityGroups: [
        { title: '房间内部设施', columnsClass: 'grid grid-cols-3 md:grid-cols-6 lg:grid-cols-8 gap-6 max-w-5xl mx-auto', items: [
          { icon: 'bed-double', label: '大床' }, { icon: 'layers', label: '床垫' }, { icon: 'armchair', label: '桌椅' }, { icon: 'archive', label: '衣柜' },
          { icon: 'air-vent', label: '冷气机' }, { icon: 'blinds', label: '窗帘' }, { icon: 'bath', label: '洗手间' }, { icon: 'flame', label: '热水器' },
          { icon: 'scan', label: '镜子' }, { icon: 'shower-head', label: '淋浴器' }, { icon: 'fan', label: '抽气扇' }, { icon: 'lock', label: '标配门锁' },
          { icon: 'lamp', label: '床头灯' }, { icon: 'plug', label: '电源插座' }, { icon: 'shirt', label: '衣架' }, { icon: 'trash', label: '垃圾桶' }
        ] },
        { title: '公共空间设施', columnsClass: 'grid grid-cols-4 gap-4', items: [
          { icon: 'arrow-up-down', label: '电梯' }, { icon: 'utensils', label: '公共厨房' }, { icon: 'wind', label: '抽油烟机' }, { icon: 'microwave', label: '微波炉' },
          { icon: 'refrigerator', label: '冰箱' }, { icon: 'wind', label: '烘干机' }, { icon: 'washing-machine', label: '洗衣机' }, { icon: 'wifi', label: 'WIFI' }
        ] },
        { title: '专属服务', columnsClass: 'grid grid-cols-4 gap-4', items: [
          { icon: 'headset', label: '专属客服' }, { icon: 'wrench', label: '设备维护' }, { icon: 'brush', label: '公区清洁' }, { icon: 'users', label: '联谊活动' }
        ] }
      ],
      floorPlans: [
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（油麻地）/油麻地平面圖(新)/油麻地平面圖(新)/1楼_结果.webp', label: '1楼', alt: '1楼 户型图' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（油麻地）/油麻地平面圖(新)/油麻地平面圖(新)/2-5楼_结果.webp', label: '2-5楼', alt: '2-5楼 户型图' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（油麻地）/油麻地平面圖(新)/油麻地平面圖(新)/1号房_结果.webp', label: '1号房', alt: '1号房 户型图' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（油麻地）/油麻地平面圖(新)/油麻地平面圖(新)/2号房_结果.webp', label: '2号房', alt: '2号房 户型图' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（油麻地）/油麻地平面圖(新)/油麻地平面圖(新)/3号房_结果.webp', label: '3号房', alt: '3号房 户型图' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（油麻地）/油麻地平面圖(新)/油麻地平面圖(新)/4号房（2-5楼）_结果.webp', label: '4号房（2-5楼）', alt: '4号房（2-5楼） 户型图' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（油麻地）/油麻地平面圖(新)/油麻地平面圖(新)/5号房_结果.webp', label: '5号房', alt: '5号房 户型图' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（油麻地）/油麻地平面圖(新)/油麻地平面圖(新)/6号房_结果.webp', label: '6号房', alt: '6号房 户型图' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（油麻地）/油麻地平面圖(新)/油麻地平面圖(新)/7号房_结果.webp', label: '7号房', alt: '7号房 户型图' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（油麻地）/油麻地平面圖(新)/油麻地平面圖(新)/8号房_结果.webp', label: '8号房', alt: '8号房 户型图' }
      ]
    },
    'apartment-csw': {
      pageKey: 'apartment-csw',
      slug: 'apartments/csw',
      titleKey: 'apt_csw_card_title',
      displayName: '汇生会社(长沙湾)',
      meta: {
        sc: { title: '汇生会社（长沙湾） | 汇生会 SDLV', description: '查看汇生会社长沙湾学生公寓的户型、配套与环境。' },
        tc: { title: '滙生会社（長沙灣） | 滙生會 SDLV', description: '查看滙生会社長沙灣學生公寓的戶型、配套與環境。' },
        en: { title: 'Cheung Sha Wan Residence | SDLV', description: 'Explore SDLV Cheung Sha Wan student accommodation, room layout, amenities, and environment.' }
      },
      hero: { badge: null, locationLine: null, mapImage: null, showInteractiveMap: false },
      transport: {
        sectionTitle: '交通出行',
        sectionSubtitle: '周边大学通勤时间 / 主要交通节点',
        cards: [
          { accent: 'navy', icon: 'graduation-cap', title: '邻近大学', items: ['香港城市大学', '香港浸会大学'] },
          { accent: 'red', icon: 'map-pin', title: '交通枢纽', items: ['油麻地站', '柯士甸站'] }
        ]
      },
      rooms: { sectionTitle: '我们的房间', sectionSubtitle: '软硬件设施一览 / 生活与学业支持服务', publicAreaHeading: '公共区域', photos: [
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（长沙湾）/公寓照片九江街/1号房/W长沙湾1号房.webp', label: '1号房', alt: '1号房' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（长沙湾）/公寓照片九江街/1号房/W长沙湾1号房%20浴室.webp', label: '1号房', alt: '1号房 浴室' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（长沙湾）/公寓照片九江街/2号房/W长沙湾2号房.webp', label: '2号房', alt: '2号房' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（长沙湾）/公寓照片九江街/2号房/W长沙湾2号房%20浴室.webp', label: '2号房', alt: '2号房 浴室' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（长沙湾）/公寓照片九江街/2号房/W长沙湾%202号房%20浴室2.webp', label: '2号房', alt: '2号房 浴室2' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（长沙湾）/公寓照片九江街/3号房/W长沙湾%203号房.webp', label: '3号房', alt: '3号房' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（长沙湾）/公寓照片九江街/3号房/W长沙湾3号房.webp', label: '3号房', alt: '3号房' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（长沙湾）/公寓照片九江街/3号房/W长沙湾%203号房%2002.webp', label: '3号房', alt: '3号房 02' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（长沙湾）/公寓照片九江街/4号房/W长沙湾%204号房%20房间_结果.webp', label: '4号房', alt: '4号房 房间' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（长沙湾）/公寓照片九江街/4号房/W长沙湾%204号房%20房间%2002_结果.webp', label: '4号房', alt: '4号房 房间 02' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（长沙湾）/公寓照片九江街/4号房/W长沙湾%204号房%20浴室_结果.webp', label: '4号房', alt: '4号房 浴室' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（长沙湾）/公寓照片九江街/5号房/W长沙湾%205号房%2001.webp', label: '5号房', alt: '5号房 01' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（长沙湾）/公寓照片九江街/5号房/W长沙湾%205号房%2002.webp', label: '5号房', alt: '5号房 02' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（长沙湾）/公寓照片九江街/5号房/W长沙湾%205号房%2003.webp', label: '5号房', alt: '5号房 03' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（长沙湾）/公寓照片九江街/6号房/W长沙湾%206号房%20房间_结果.webp', label: '6号房', alt: '6号房 房间' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（长沙湾）/公寓照片九江街/6号房/W长沙湾%206号房%2002房间_结果.webp', label: '6号房', alt: '6号房 02房间' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（长沙湾）/公寓照片九江街/6号房/W长沙湾%206号房%2003房间_结果.webp', label: '6号房', alt: '6号房 03房间' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（长沙湾）/公寓照片九江街/7号房/W长沙湾%207号房%2001_结果.webp', label: '7号房', alt: '7号房 01' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（长沙湾）/公寓照片九江街/7号房/W长沙湾%207号房%2002_结果.webp', label: '7号房', alt: '7号房 02' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（长沙湾）/公寓照片九江街/7号房/W长沙湾%207号房%2003_结果.webp', label: '7号房', alt: '7号房 03' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（长沙湾）/公寓照片九江街/8号房/长沙湾%208号房%2001_结果.webp', label: '8号房', alt: '8号房 01' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（长沙湾）/公寓照片九江街/8号房/长沙湾%208号房%2002_结果.webp', label: '8号房', alt: '8号房 02' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（长沙湾）/公寓照片九江街/公共区域/W学生取信处.webp', label: '公共区域', alt: '公共区域 学生取信处' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（长沙湾）/公寓照片九江街/公共区域/W长沙湾%20休息区%2B洗衣区%20全景.webp', label: '公共区域', alt: '公共区域 休息区+洗衣区' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（长沙湾）/公寓照片九江街/公共区域/W长沙湾%20休息区.webp', label: '公共区域', alt: '公共区域 休息区' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（长沙湾）/公寓照片九江街/公共区域/W长沙湾%20健身区.webp', label: '公共区域', alt: '公共区域 健身区' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（长沙湾）/公寓照片九江街/公共区域/W长沙湾%20厨房%2002%20全景.webp', label: '公共区域', alt: '公共区域 厨房 02 全景' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（长沙湾）/公寓照片九江街/公共区域/W长沙湾%20厨房%20冰箱区域.webp', label: '公共区域', alt: '公共区域 厨房 冰箱区域' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（长沙湾）/公寓照片九江街/公共区域/W长沙湾%20厨房.webp', label: '公共区域', alt: '公共区域 厨房' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（长沙湾）/公寓照片九江街/公共区域/W长沙湾%20天台休息区.webp', label: '公共区域', alt: '公共区域 天台休息区' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（长沙湾）/公寓照片九江街/公共区域/W长沙湾%20洗衣房.webp', label: '公共区域', alt: '公共区域 洗衣房' }
      ] },
      booking: { enabled: true, ctaText: '抢先以早鸟价格订房', modalTitle: '立即预定', modalDescription: '请扫描二维码，立即预定房间!', qrCode: bookingQrCode, excludeLabels: ['公共区域'] },
      lifestyleCards: [],
      amenityGroups: [],
      floorPlans: []
    },
    'apartment-tst': {
      pageKey: 'apartment-tst', slug: 'apartments/tst', titleKey: 'apt_tst_card_title', displayName: '汇生会社(尖沙咀)',
      meta: {
        sc: { title: '汇生会社（尖沙咀） | 汇生会 SDLV', description: '查看汇生会社尖沙咀学生公寓的户型、配套与环境。' },
        tc: { title: '滙生会社（尖沙咀） | 滙生會 SDLV', description: '查看滙生会社尖沙咀學生公寓的戶型、配套與環境。' },
        en: { title: 'Tsim Sha Tsui Residence | SDLV', description: 'Explore SDLV Tsim Sha Tsui student accommodation, room layout, amenities, and environment.' }
      },
      hero: { badge: null, locationLine: null, mapImage: null, showInteractiveMap: false },
      transport: { sectionTitle: '交通出行', sectionSubtitle: '周边大学通勤时间 / 主要交通节点', cards: [
        { accent: 'navy', icon: 'graduation-cap', title: '邻近大学', items: ['香港理工大学', '香港城市大学', '香港浸会大学', '香港都会大学', '香港大学'] },
        { accent: 'red', icon: 'map-pin', title: '交通枢纽', items: ['尖沙咀站', '尖东站'] }
      ] },
      rooms: { sectionTitle: '我们的房间', sectionSubtitle: '软硬件设施一览 / 生活与学业支持服务', publicAreaHeading: '公共区域', photos: [
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（尖沙咀）/尖沙咀公寓照片/多福2026%20效果圖/101/101_结果.webp', label: '101', alt: '101房' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（尖沙咀）/尖沙咀公寓照片/多福2026%20效果圖/101/101厕所_结果.webp', label: '101', alt: '101房 卫生间' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（尖沙咀）/尖沙咀公寓照片/多福2026%20效果圖/102/102_结果.webp', label: '102', alt: '102房' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（尖沙咀）/尖沙咀公寓照片/多福2026%20效果圖/103/103_结果.webp', label: '103', alt: '103房' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（尖沙咀）/尖沙咀公寓照片/多福2026%20效果圖/103/103厕所_结果.webp', label: '103', alt: '103房 卫生间' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（尖沙咀）/尖沙咀公寓照片/多福2026%20效果圖/104-106-107/104、106、107_结果.webp', label: '104/106/107', alt: '104/106/107房' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（尖沙咀）/尖沙咀公寓照片/多福2026%20效果圖/104-106-107/104、106、107厕所_结果.webp', label: '104/106/107', alt: '104/106/107房 卫生间' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（尖沙咀）/尖沙咀公寓照片/多福2026%20效果圖/105-108/105,108_结果.webp', label: '105/108', alt: '105/108房' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（尖沙咀）/尖沙咀公寓照片/多福2026%20效果圖/105-108/105、108厕所_结果.webp', label: '105/108', alt: '105/108房 卫生间' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（尖沙咀）/尖沙咀公寓照片/多福2026%20效果圖/109/109_结果.webp', label: '109', alt: '109房' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（尖沙咀）/尖沙咀公寓照片/多福2026%20效果圖/109/109厕所_结果.webp', label: '109', alt: '109房 卫生间' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（尖沙咀）/尖沙咀公寓照片/多福2026%20效果圖/110/110_结果.webp', label: '110', alt: '110房' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（尖沙咀）/尖沙咀公寓照片/多福2026%20效果圖/110/110厕所_结果.webp', label: '110', alt: '110房 卫生间' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（尖沙咀）/尖沙咀公寓照片/多福2026%20效果圖/公共区域/厨房1_结果.webp', label: '公共区域', alt: '公共区域 厨房1' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（尖沙咀）/尖沙咀公寓照片/多福2026%20效果圖/公共区域/厨房_结果.webp', label: '公共区域', alt: '公共区域 厨房' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（尖沙咀）/尖沙咀公寓照片/多福2026%20效果圖/公共区域/厨房厕所_结果.webp', label: '公共区域', alt: '公共区域 厨房卫生间' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（尖沙咀）/尖沙咀公寓照片/多福2026%20效果圖/公共区域/尖沙咀多福大厦_结果.webp', label: '公共区域', alt: '公共区域 多福大厦' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（尖沙咀）/尖沙咀公寓照片/多福2026%20效果圖/公共区域/洗衣房_结果.webp', label: '公共区域', alt: '公共区域 洗衣房' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（尖沙咀）/尖沙咀公寓照片/多福2026%20效果圖/公共区域/自修室_结果.webp', label: '公共区域', alt: '公共区域 自修室' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（尖沙咀）/尖沙咀公寓照片/一楼电梯口%20信封区域_结果.webp', label: '公共区域', alt: '公共区域 一楼电梯口信封区域' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（尖沙咀）/尖沙咀公寓照片/公寓走廊_结果.webp', label: '公共区域', alt: '公共区域 公寓走廊' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（尖沙咀）/尖沙咀公寓照片/公寓走廊_结果_结果.webp', label: '公共区域', alt: '公共区域 公寓走廊' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（尖沙咀）/尖沙咀公寓照片/厨房_结果.webp', label: '公共区域', alt: '公共区域 厨房' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（尖沙咀）/尖沙咀公寓照片/厨房_结果_结果.webp', label: '公共区域', alt: '公共区域 厨房' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（尖沙咀）/尖沙咀公寓照片/尖沙咀%20外围门牌图片_结果.webp', label: '公共区域', alt: '公共区域 外围门牌' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（尖沙咀）/尖沙咀公寓照片/楼下门口%20_结果.webp', label: '公共区域', alt: '公共区域 楼下门口' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（尖沙咀）/尖沙咀公寓照片/洗衣房_结果.webp', label: '公共区域', alt: '公共区域 洗衣房' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社（尖沙咀）/尖沙咀公寓照片/自修室_结果.webp', label: '公共区域', alt: '公共区域 自修室' }
      ] },
      booking: { enabled: true, ctaText: '抢先以早鸟价格订房', modalTitle: '立即预定', modalDescription: '请扫描二维码，立即预定房间!', qrCode: bookingQrCode, excludeLabels: ['公共区域'] },
      lifestyleCards: [], amenityGroups: [], floorPlans: []
    },
    'apartment-oy': {
      pageKey: 'apartment-oy', slug: 'apartments/oy', titleKey: 'apt_oy_card_title', displayName: '汇生会社(奥运)',
      meta: {
        sc: { title: '汇生会社（奥运） | 汇生会 SDLV', description: '查看汇生会社奥运学生公寓的户型、配套与环境。' },
        tc: { title: '滙生会社（奧運） | 滙生會 SDLV', description: '查看滙生会社奧運學生公寓的戶型、配套與環境。' },
        en: { title: 'Olympic Residence | SDLV', description: 'Explore SDLV Olympic student accommodation, room layout, amenities, and environment.' }
      },
      hero: { badge: null, locationLine: null, mapImage: null, showInteractiveMap: false },
      transport: { sectionTitle: '交通出行', sectionSubtitle: '周边大学通勤时间 / 主要交通节点', cards: [
        { accent: 'navy', icon: 'graduation-cap', title: '邻近大学', items: ['香港理工大学', '香港城市大学', '香港浸会大学', '香港都会大学'] },
        { accent: 'red', icon: 'map-pin', title: '交通枢纽', items: ['油麻地站', '柯士甸站'] }
      ] },
      rooms: { sectionTitle: '我们的房间', sectionSubtitle: '软硬件设施一览 / 生活与学业支持服务', publicAreaHeading: '公共区域', photos: [
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社青年公寓（城汇奥运）/三号房/三号房_结果.webp', label: '三号房', alt: '三号房' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社青年公寓（城汇奥运）/三号房/三号房%2002_结果.webp', label: '三号房', alt: '三号房 02' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社青年公寓（城汇奥运）/三号房/三号房%2003_结果.webp', label: '三号房', alt: '三号房 03' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社青年公寓（城汇奥运）/四号房/四号房_结果.webp', label: '四号房', alt: '四号房' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社青年公寓（城汇奥运）/四号房/四号房%2002_结果.webp', label: '四号房', alt: '四号房 02' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社青年公寓（城汇奥运）/四号房/四号房%2003_结果.webp', label: '四号房', alt: '四号房 03' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社青年公寓（城汇奥运）/四号房/四号房%2004_结果.webp', label: '四号房', alt: '四号房 04' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社青年公寓（城汇奥运）/五号房/五号房_结果.webp', label: '五号房', alt: '五号房' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社青年公寓（城汇奥运）/五号房/五号房%2002_结果.webp', label: '五号房', alt: '五号房 02' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社青年公寓（城汇奥运）/五号房/五号房%2003_结果.webp', label: '五号房', alt: '五号房 03' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社青年公寓（城汇奥运）/公共区域/大堂_结果.webp', label: '公共区域', alt: '公共区域 大堂' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社青年公寓（城汇奥运）/公共区域/大堂%2002_结果.webp', label: '公共区域', alt: '公共区域 大堂 02' },
        { src: 'https://static.sdlvhk.com/图片素材/other/Image%206.2%20学生居社/2026%20最新公寓照片/汇生会社青年公寓（城汇奥运）/公共区域/酒店外围_结果.webp', label: '公共区域', alt: '公共区域 酒店外围' }
      ] },
      booking: { enabled: true, ctaText: '抢先以早鸟价格订房', modalTitle: '立即预定', modalDescription: '请扫描二维码，立即预定房间!', qrCode: bookingQrCode, excludeLabels: ['公共区域'] },
      lifestyleCards: [], amenityGroups: [], floorPlans: []
    },
    'apartment-syp1': {
      pageKey: 'apartment-syp1', slug: 'apartments/syp1', titleKey: 'apt_syp1_card_title', displayName: '汇生会社(西营盘一期)',
      meta: {
        sc: { title: '汇生会社（西营盘一期） | 汇生会 SDLV', description: '查看汇生会社西营盘一期学生公寓的户型、配套与环境。' },
        tc: { title: '滙生会社（西營盤一期） | 滙生會 SDLV', description: '查看滙生会社西營盤一期學生公寓的戶型、配套與環境。' },
        en: { title: 'Sai Ying Pun Phase 1 Residence | SDLV', description: 'Explore SDLV Sai Ying Pun Phase 1 student accommodation, room layout, amenities, and environment.' }
      },
      hero: { badge: null, locationLine: null, mapImage: null, showInteractiveMap: false },
      transport: { sectionTitle: '交通出行', sectionSubtitle: '周边大学通勤时间 / 主要交通节点', cards: [
        { accent: 'navy', icon: 'graduation-cap', title: '邻近大学', items: ['香港大学', '香港演艺学院', '香港树仁大学'] },
        { accent: 'red', icon: 'map-pin', title: '交通枢纽', items: ['西营盘站'] }
      ] },
      rooms: { sectionTitle: '我们的房间', sectionSubtitle: '软硬件设施一览 / 生活与学业支持服务', publicAreaHeading: null, photos: [
        { src: '/assets/apartments/syp1/room-a-room-c-01.webp', label: 'RoomA-RoomC', alt: 'RoomA-RoomC' },
        { src: '/assets/apartments/syp1/room-a-room-c-02.webp', label: 'RoomA-RoomC', alt: 'RoomA-RoomC 02' },
        { src: '/assets/apartments/syp1/room-d-01.webp', label: 'RoomD', alt: 'RoomD' },
        { src: '/assets/apartments/syp1/room-e-01.webp', label: 'RoomE', alt: 'RoomE' },
        { src: '/assets/apartments/syp1/room-e-02.webp', label: 'RoomE', alt: 'RoomE 02' }
      ] },
      booking: { enabled: true, ctaText: '抢先以早鸟价格订房', modalTitle: '立即预定', modalDescription: '请扫描二维码，立即预定房间!', qrCode: bookingQrCode, excludeLabels: [] },
      lifestyleCards: [], amenityGroups: [], floorPlans: []
    },
    'apartment-syp2': {
      pageKey: 'apartment-syp2', slug: 'apartments/syp2', titleKey: 'apt_syp2_card_title', displayName: '汇生会社(西营盘二期)',
      meta: {
        sc: { title: '汇生会社（西营盘二期） | 汇生会 SDLV', description: '查看汇生会社西营盘二期学生公寓的户型、配套与环境。' },
        tc: { title: '滙生会社（西營盤二期） | 滙生會 SDLV', description: '查看滙生会社西營盤二期學生公寓的戶型、配套與環境。' },
        en: { title: 'Sai Ying Pun Phase 2 Residence | SDLV', description: 'Explore SDLV Sai Ying Pun Phase 2 student accommodation, room layout, amenities, and environment.' }
      },
      hero: { badge: null, locationLine: '居社地理位置：香港西营盘高升大厦', mapImage: null, showInteractiveMap: false },
      transport: { sectionTitle: '交通出行', sectionSubtitle: '周边大学通勤时间 / 主要交通节点', cards: [] },
      rooms: { sectionTitle: '我们的房间', sectionSubtitle: '软硬件设施一览 / 生活与学业支持服务', publicAreaHeading: null, photos: [
        { src: '/assets/apartments/syp2/dining-room-01.webp', label: 'Dining Room', alt: 'Dining Room 01' },
        { src: '/assets/apartments/syp2/dining-room-02.webp', label: 'Dining Room', alt: 'Dining Room 02' },
        { src: '/assets/apartments/syp2/dining-room-03.webp', label: 'Dining Room', alt: 'Dining Room 03' },
        { src: '/assets/apartments/syp2/dining-room-04.webp', label: 'Dining Room', alt: 'Dining Room 04' },
        { src: '/assets/apartments/syp2/wc-01.webp', label: 'WC', alt: 'WC' },
        { src: '/assets/apartments/syp2/balcony-01.webp', label: '阳台', alt: '阳台' }
      ] },
      booking: { enabled: false, ctaText: '抢先以早鸟价格订房', modalTitle: '立即预定', modalDescription: '请扫描二维码，立即预定房间!', qrCode: bookingQrCode, excludeLabels: ['公共区域'] },
      lifestyleCards: [], amenityGroups: [], floorPlans: []
    },
    'apartment-syp3': {
      pageKey: 'apartment-syp3', slug: 'apartments/syp3', titleKey: 'apt_syp3_card_title', displayName: '汇生会社(西营盘三期)',
      meta: {
        sc: { title: '汇生会社（西营盘三期） | 汇生会 SDLV', description: '查看汇生会社西营盘三期学生公寓的户型、配套与环境。' },
        tc: { title: '滙生会社（西營盤三期） | 滙生會 SDLV', description: '查看滙生会社西營盤三期學生公寓的戶型、配套與環境。' },
        en: { title: 'Sai Ying Pun Phase 3 Residence | SDLV', description: 'Explore SDLV Sai Ying Pun Phase 3 student accommodation, room layout, amenities, and environment.' }
      },
      hero: { badge: null, locationLine: null, mapImage: null, showInteractiveMap: false },
      transport: { sectionTitle: '交通出行', sectionSubtitle: '周边大学通勤时间 / 主要交通节点', cards: [
        { accent: 'navy', icon: 'graduation-cap', title: '邻近大学', items: ['香港大学', '香港演艺学院', '香港树仁大学'] },
        { accent: 'red', icon: 'map-pin', title: '交通枢纽', items: ['西营盘站'] }
      ] },
      rooms: { sectionTitle: '我们的房间', sectionSubtitle: '软硬件设施一览 / 生活与学业支持服务', publicAreaHeading: '公共区域', photos: [
        { src: '/assets/apartments/syp3/room-1-01.webp', label: '1号房', alt: '1号房 01' }, { src: '/assets/apartments/syp3/room-1-02.webp', label: '1号房', alt: '1号房 02' }, { src: '/assets/apartments/syp3/room-1-03.webp', label: '1号房', alt: '1号房 03' },
        { src: '/assets/apartments/syp3/room-2-01.webp', label: '2号房', alt: '2号房 01' }, { src: '/assets/apartments/syp3/room-2-02.webp', label: '2号房', alt: '2号房 02' }, { src: '/assets/apartments/syp3/room-2-03.webp', label: '2号房', alt: '2号房 03' },
        { src: '/assets/apartments/syp3/room-3-01.webp', label: '3号房', alt: '3号房 01' }, { src: '/assets/apartments/syp3/room-3-02.webp', label: '3号房', alt: '3号房 02' }, { src: '/assets/apartments/syp3/room-3-03.webp', label: '3号房', alt: '3号房 03' },
        { src: '/assets/apartments/syp3/room-4-01.webp', label: '4号房', alt: '4号房 01' }, { src: '/assets/apartments/syp3/room-4-02.webp', label: '4号房', alt: '4号房 02' }, { src: '/assets/apartments/syp3/room-4-03.webp', label: '4号房', alt: '4号房 03' },
        { src: '/assets/apartments/syp3/room-g02-01.webp', label: 'G02房', alt: 'G02房 01' }, { src: '/assets/apartments/syp3/room-g02-02.webp', label: 'G02房', alt: 'G02房 02' },
        { src: '/assets/apartments/syp3/room-g03-01.webp', label: 'G03房', alt: 'G03房 01' }, { src: '/assets/apartments/syp3/room-g03-02.webp', label: 'G03房', alt: 'G03房 02' },
        { src: '/assets/apartments/syp3/public-kitchen-01.webp', label: '公共区域', alt: '公共区域 厨房' }, { src: '/assets/apartments/syp3/public-kitchen-02.webp', label: '公共区域', alt: '公共区域 厨房2' },
        { src: '/assets/apartments/syp3/public-wc-01.webp', label: '公共区域', alt: '公共区域 洗手间' }, { src: '/assets/apartments/syp3/public-wc-panorama-01.webp', label: '公共区域', alt: '公共区域 洗手间全景' },
        { src: '/assets/apartments/syp3/public-bathroom-01.webp', label: '公共区域', alt: '公共区域 浴室' }, { src: '/assets/apartments/syp3/public-corridor-01.webp', label: '公共区域', alt: '公共区域 走廊' }
      ] },
      booking: { enabled: false, ctaText: '抢先以早鸟价格订房', modalTitle: '立即预定', modalDescription: '请扫描二维码，立即预定房间!', qrCode: bookingQrCode, excludeLabels: ['公共区域'] },
      lifestyleCards: [], amenityGroups: [], floorPlans: []
    },
    'apartment-pfl': {
      pageKey: 'apartment-pfl', slug: 'apartments/pfl', titleKey: 'apt_pfl_card_title', displayName: '汇生会社(薄扶林)',
      meta: {
        sc: { title: '汇生会社（薄扶林） | 汇生会 SDLV', description: '查看汇生会社薄扶林学生公寓的户型、配套与环境。' },
        tc: { title: '滙生会社（薄扶林） | 滙生會 SDLV', description: '查看滙生会社薄扶林學生公寓的戶型、配套與環境。' },
        en: { title: 'Pok Fu Lam Residence | SDLV', description: 'Explore SDLV Pok Fu Lam student accommodation, room layout, amenities, and environment.' }
      },
      hero: { badge: null, locationLine: null, mapImage: null, showInteractiveMap: false },
      transport: { sectionTitle: '交通出行', sectionSubtitle: '周边大学通勤时间 / 主要交通节点', cards: [
        { accent: 'navy', icon: 'graduation-cap', title: '邻近大学', items: ['香港大学'] },
        { accent: 'red', icon: 'map-pin', title: '交通枢纽', items: ['多条巴士线路直达香港大学'] }
      ] },
      rooms: { sectionTitle: '我们的房间', sectionSubtitle: '软硬件设施一览 / 生活与学业支持服务', publicAreaHeading: '公共区域', photos: [
        { src: '/assets/apartments/pfl/room-1-01.webp', label: '1号房', alt: '1号房 01' }, { src: '/assets/apartments/pfl/room-1-02.webp', label: '1号房', alt: '1号房 02' },
        { src: '/assets/apartments/pfl/room-2-01.webp', label: '2号房', alt: '2号房 01' }, { src: '/assets/apartments/pfl/room-3-01.webp', label: '3号房', alt: '3号房 01' },
        { src: '/assets/apartments/pfl/room-3-02.webp', label: '3号房', alt: '3号房 02' }, { src: '/assets/apartments/pfl/room-4-01.webp', label: '4号房', alt: '4号房 01' },
        { src: '/assets/apartments/pfl/room-4-02.webp', label: '4号房', alt: '4号房 02' }, { src: '/assets/apartments/pfl/public-lobby-01.webp', label: '公共区域', alt: '公共区域 一楼大堂' },
        { src: '/assets/apartments/pfl/public-building-panorama-01.webp', label: '公共区域', alt: '公共区域 单元楼全景' }, { src: '/assets/apartments/pfl/public-kitchen-01.webp', label: '公共区域', alt: '公共区域 厨房' },
        { src: '/assets/apartments/pfl/public-living-room-01.webp', label: '公共区域', alt: '公共区域 客厅' }, { src: '/assets/apartments/pfl/public-wc-01.webp', label: '公共区域', alt: '公共区域 洗手间' },
        { src: '/assets/apartments/pfl/public-elevator-01.webp', label: '公共区域', alt: '公共区域 电梯' }, { src: '/assets/apartments/pfl/public-estate-map-01.webp', label: '公共区域', alt: '公共区域 置富花园小区图' },
        { src: '/assets/apartments/pfl/public-location-map-01.webp', label: '公共区域', alt: '公共区域 置富花园地图' }
      ] },
      booking: { enabled: false, ctaText: '抢先以早鸟价格订房', modalTitle: '立即预定', modalDescription: '请扫描二维码，立即预定房间!', qrCode: bookingQrCode, excludeLabels: ['公共区域'] },
      lifestyleCards: [], amenityGroups: [], floorPlans: []
    }
  };

  const defaultApartmentPageKeys = new Set(Object.keys(apartmentPages));

  function cloneValue(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function persistCustomApartmentPages() {
    if (typeof localStorage === 'undefined') {
      return;
    }

    const customEntries = Object.fromEntries(
      Object.entries(apartmentPages).filter(([pageKey]) => !defaultApartmentPageKeys.has(pageKey))
    );

    try {
      localStorage.setItem(customApartmentsStorageKey, JSON.stringify(customEntries));
    } catch {
      // Ignore persistence failures in non-browser or storage-limited environments.
    }
  }

  function loadCustomApartmentPages() {
    if (customApartmentSource && typeof customApartmentSource === 'object') {
      Object.entries(customApartmentSource).forEach(([pageKey, apartment]) => {
        if (pageKey && apartment && typeof apartment === 'object') {
          apartmentPages[pageKey] = cloneValue(apartment);
        }
      });
    }

    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      const raw = localStorage.getItem(customApartmentsStorageKey);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        return;
      }

      Object.entries(parsed).forEach(([pageKey, apartment]) => {
        if (pageKey && apartment && typeof apartment === 'object') {
          apartmentPages[pageKey] = apartment;
        }
      });
    } catch {
      // Ignore invalid persisted payloads.
    }
  }

  function getApartmentPageKeys() {
    return Object.keys(apartmentPages);
  }

  function addApartmentPage(apartmentRecord, options = {}) {
    const { overwrite = false, persist = true } = options;
    const pageKey = String(apartmentRecord && apartmentRecord.pageKey || '').trim();

    if (!pageKey) {
      throw new Error('Apartment record must include a pageKey.');
    }

    if (!overwrite && apartmentPages[pageKey]) {
      throw new Error(`Apartment page already exists: ${pageKey}`);
    }

    apartmentPages[pageKey] = cloneValue(apartmentRecord);

    if (persist) {
      persistCustomApartmentPages();
    }

    return apartmentPages[pageKey];
  }

  loadCustomApartmentPages();

  return {
    bookingQrCode,
    apartmentPages,
    getApartmentPageKeys,
    addApartmentPage,
    persistCustomApartmentPages
  };
}));