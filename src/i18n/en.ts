/**
 * Every UI string in the site. A second language means adding it.ts with the
 * same keys (TypeScript will flag any missing one) and wiring it in index.ts.
 * Functions are used where a string needs numbers or names in it.
 */
export const en = {
  siteName: 'The 20th Century in 100 Days',
  siteDescription:
    'One important day for every year from 1900 to 2000, told on a map, with books, films, podcasts and archives to go deeper.',

  nav: {
    map: 'Map',
    goDeeper: 'Go deeper',
    stats: 'Stats',
  },

  map: {
    label: 'World map of the century',
    sliderLabel: 'Year',
    notWritten: 'Not yet written',
    notWrittenLong: 'This year has no day yet.',
    openDay: 'Read the day',
    draft: 'Draft',
    hint: 'Drag, scroll, swipe or use ← → to move through the century',
    pointLabel: (year: number, title: string) => `${year}: ${title}`,
    empty: 'No days written yet.',
  },

  day: {
    close: 'Close',
    closeToMap: 'Back to the map',
    prev: 'Previous',
    next: 'Next',
    whyItMatters: 'Why it matters',
    place: 'Place',
    then: 'then',
    today: 'today',
    themes: 'Themes',
    people: 'People',
    goDeeper: 'Go deeper',
    sources: 'Sources',
    dateNote: 'Note on the date',
    draftBanner: 'Draft: visible only in development.',
  },

  types: {
    book: { one: 'Book', many: 'Books' },
    film: { one: 'Film', many: 'Films' },
    documentary: { one: 'Documentary', many: 'Documentaries' },
    podcast: { one: 'Podcast', many: 'Podcasts' },
    article: { one: 'Article', many: 'Articles' },
    place: { one: 'Place to visit', many: 'Places to visit' },
    archive: { one: 'Archive', many: 'Archives' },
  },

  themes: {
    politics: 'Politics',
    war: 'War',
    science: 'Science',
    technology: 'Technology',
    culture: 'Culture',
    economy: 'Economy',
    society: 'Society',
    sport: 'Sport',
    environment: 'Environment',
    religion: 'Religion',
  },

  goDeeperPage: {
    title: 'Go deeper',
    intro: 'Everything suggested across the site: books, films, documentaries, podcasts, articles, places and archives.',
    filterType: 'Type',
    filterLanguage: 'Language',
    filterDecade: 'Decade of the day',
    filterTheme: 'Theme',
    all: 'All',
    reset: 'Reset filters',
    count: (shown: number, total: number) => (shown === total ? `${total} items` : `${shown} of ${total} items`),
    from: 'From',
    noneYet: 'Nothing suggested yet. Items appear here as days are written.',
    noMatch: 'No items match these filters.',
  },

  stats: {
    title: 'Stats',
    intro: 'Computed from the days at build time. They update every time a day is added.',
    progress: (n: number, total: number) => `${n} of ${total} days written`,
    sparse: (n: number, total: number) => `${n} of ${total} days: not yet meaningful.`,
    noData: 'No days written yet.',
    perDecade: 'Days per decade',
    perWeekday: 'Days by weekday',
    perMonth: 'Days by month',
    perSeason: 'Days by season',
    seasonNote: 'Meteorological seasons, flipped for places in the southern hemisphere.',
    perContinent: 'By continent',
    perCountryThen: 'By country (as it was then)',
    perCountryToday: 'By country (today)',
    perTheme: 'By theme',
    themeNote: 'A day can have more than one theme.',
    centre: 'Centre of gravity',
    centreNote: 'The average location of the days in each decade, computed on the sphere. The ring marks the whole century so far.',
    centreUndefined: 'Undefined: the points cancel each other out.',
    people: 'Most recurring people',
    peopleNone: 'No people listed yet.',
    goDeeperByType: 'Go deeper items by type',
    goDeeperByLanguage: 'Go deeper items by language',
    mostItems: 'Days with the most items',
    fewestItems: 'Days with the fewest items',
    items: (n: number) => (n === 1 ? '1 item' : `${n} items`),
    days: (n: number) => (n === 1 ? '1 day' : `${n} days`),
    andMore: (n: number) => `and ${n} more`,
  },

  weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  seasons: ['Winter', 'Spring', 'Summer', 'Autumn'],

  notFound: {
    title: 'Page not found',
    body: 'This page does not exist, or this year has not been written yet.',
    back: 'Back to the map',
  },
};

export type UI = typeof en;
