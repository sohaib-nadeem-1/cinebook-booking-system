import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { store } from '../utils/storage.js';
import { showtimeService } from '../services/showtimeService.js';

const Ctx = createContext(null);

export function PrefsProvider({ children }) {
  const [cinemaId, setCinemaId] = useState(() => store.get('prefCinema', ''));
  const [cinemas, setCinemas] = useState([]);
  const [cinemasLoading, setCinemasLoading] = useState(true);
  const [cinemasError, setCinemasError] = useState(null);

  useEffect(() => {
    let active = true;
    showtimeService.resources()
      .then((resources) => {
        if (active) setCinemas(resources.cinemas || []);
      })
      .catch((error) => {
        if (active) setCinemasError(error);
      })
      .finally(() => {
        if (active) setCinemasLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!cinemasLoading && cinemas.length && !cinemas.some((cinema) => Number(cinema.id) === Number(cinemaId))) {
      const firstId = Number(cinemas[0].id);
      setCinemaId(firstId);
      store.set('prefCinema', firstId);
    }
  }, [cinemasLoading, cinemas, cinemaId]);

  const cinema = useMemo(
    () => cinemas.find((item) => Number(item.id) === Number(cinemaId)) || null,
    [cinemas, cinemaId]
  );
  const setCinema = (id) => {
    const value = Number(id);
    if (!Number.isSafeInteger(value) || value <= 0) return;
    setCinemaId(value);
    store.set('prefCinema', value);
  };
  const value = useMemo(() => ({
    cinemaId,
    cinema,
    cinemas,
    cinemasLoading,
    cinemasError,
    setCinema,
  }), [cinemaId, cinema, cinemas, cinemasLoading, cinemasError]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const usePrefs = () => useContext(Ctx);
