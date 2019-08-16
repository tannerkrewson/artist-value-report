const axios = require('axios');
const cheerio = require('cheerio');

const LASTFM = "http://ws.audioscrobbler.com/2.0/?method=chart.gettopartists&api_key=c68ea49b4e861204b0e6b6607a77c542&format=json";
const DEGY = "https://www.degy.com/artistsearch/?wpv_post_search=";

const fetchTopArtists = async () => {
    const result = await axios.get(LASTFM);
    const artists = result.data.artists.artist;

    return artists.map(artist => ({
        lastFmName: artist.name,
        playcount: artist.playcount,
        listeners: artist.listeners
    }));
};

const fetchArtistCost = async artistName => {
    const result = await axios.get(DEGY + artistName);
    const $ = cheerio.load(result.data);

    const matchingArtists = $('#customscroller').find('tr');

    if (matchingArtists.length === 0) return false;

    const firstArtist = matchingArtists[0];
    const firstArtistColumns = firstArtist.children;

    const minPrice = moneyToInt($(firstArtistColumns[1]).text());
    const maxPrice = moneyToInt($(firstArtistColumns[2]).text());

    return {
        degyName: $(firstArtistColumns[0]).text(),
        minPrice,
        maxPrice
    };
};

// removes , and $
// and converts string to number
const moneyToInt = money => parseInt(money.replace(/\,|\$/g,''));

const main = async () => {
    const topArtists = await fetchTopArtists();

    const valueArtists = await Promise.all(topArtists.map(async lastFmArtist => {
        const degyArtist = await fetchArtistCost(lastFmArtist.lastFmName);
        if (!degyArtist) return false;

        const minValue = lastFmArtist.listeners / degyArtist.minPrice;
        const maxValue = lastFmArtist.listeners / degyArtist.maxPrice;

        return {
            ...lastFmArtist,
            ...degyArtist,
            minValue,
            maxValue
        }
    }));

    const sortedValueArtists = valueArtists.filter(e => !!e).sort((a, b) => b.maxValue - a.maxValue);

    console.log(sortedValueArtists);
}

main();
