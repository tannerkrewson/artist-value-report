const axios = require('axios');

const throttleActions = require('./throttleActions');

const LAST_FM_LIMIT = 999;
const PARALLEL_DEGY_REQUEST_LIMIT = 50;
const TOP_VALUE_ARTIST_LIMIT = 200;
const MAX_MIN_PRICE = 100001;

const LASTFM = "http://ws.audioscrobbler.com/2.0/?method=chart.gettopartists&api_key=c68ea49b4e861204b0e6b6607a77c542&format=json&limit=" + LAST_FM_LIMIT;
const DEGY = "https://portal.degy.com/ArtistSearch/ArtistSearchResult?page=0&artist=";

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
    let result;
    try {
        result = await axios.get(DEGY + artistName);
    } catch (error) {
        return false;
    }

    const matchingArtists = result.data.data;
    
    if (matchingArtists.length === 0) {
        return false;
    }

    const firstArtist = matchingArtists[0];

    const degyName = firstArtist.artistName

    if (!isSameArtist(artistName, degyName)) {
        return false;
    }

    const minPrice = moneyToInt(firstArtist.minPrice);
    const maxPrice = moneyToInt(firstArtist.maxPrice);

    if (minPrice > MAX_MIN_PRICE || minPrice === 0) {
        return false;
    }

    return {
        degyName,
        minPrice,
        maxPrice
    };
};

const isSameArtist = (a, b) => {
    // removes not alphanum characters and lower case
    const x = a.replace(/[^0-9a-z]/gi, '').toLowerCase();
    const y = b.replace(/[^0-9a-z]/gi, '').toLowerCase();

    return x === y;
};

// removes , and $
// and converts string to number
const moneyToInt = money => parseInt(money.replace(/\,|\$/g,''));

const main = async () => {
    console.log('Getting top', LAST_FM_LIMIT, 'artists from Last.fm...');
    
    const topArtists = await fetchTopArtists();
    console.log('Received top', topArtists.length, 'artists.');
    
    let successCount = 0;
    let failCount = 0;
    let valueArtistsPromises = [];
    
    topArtists.forEach(lastFmArtist => {
        valueArtistsPromises.push(async () => {
            console.log(successCount + failCount);
            
            const degyArtist = await fetchArtistCost(lastFmArtist.lastFmName);
            if (!degyArtist) {
                failCount++;
                return false;
            }
            successCount++;
    
            const minValue = lastFmArtist.listeners / degyArtist.minPrice;
            const maxValue = lastFmArtist.listeners / degyArtist.maxPrice;
    
            return {
                ...lastFmArtist,
                ...degyArtist,
                minValue,
                maxValue
            };
        });
    });

    const valueArtists = await throttleActions(valueArtistsPromises, PARALLEL_DEGY_REQUEST_LIMIT);

    const sortedValueArtists = valueArtists.filter(e => !!e).sort((a, b) => b.maxValue - a.maxValue);

    console.log(sortedValueArtists.splice(0,TOP_VALUE_ARTIST_LIMIT));
    console.log('degy success', successCount);
    console.log('degy fail', failCount);
}

main();

