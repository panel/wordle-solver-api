import { serve } from "https://deno.land/std@0.123.0/http/server.ts";
import { crypto } from "https://deno.land/std@0.123.0/crypto/mod.ts";
import { urlParse } from "https://deno.land/x/url_parse/mod.ts";

interface LetterResult {
  letter: string;
  result: number;
}

interface Game {
  id: string;
  word: string;
  guesses: string[];
  feedback: LetterResult[][];
  solved: boolean;
  engine?: string;
}

const games = {} as { [key: string]: Game };

const check = (solution: string, word: string): LetterResult[] => {
  if (!dictionary.includes(word)) {
    throw new Error(`${word} is not a valid word`);
  }

  return word.split("").map((letter, index) => {
    if (letter === solution[index]) {
      return { letter, result: 2 };
    }

    if (solution.split("").includes(letter)) {
      return { letter, result: 1 };
    }

    return { letter, result: 0 };
  });
};

const dictionary: string[] = await Deno.readTextFile("./fiveLetterWords.txt")
  .then((data) => data.split("\n"));

const makeGame = (engine?: string): Game => {
  const word = dictionary[Math.floor(Math.random() * dictionary.length)];
  return {
    id: crypto.randomUUID(),
    guesses: [],
    feedback: [],
    solved: false,
    word,
    engine,
  };
};

const matchGame = /^\/game\/(?<gameId>[\w-]{36})$/;
const matchGameAndGuess = /^\/game\/(?<gameId>[\w-]{36})\/(?<guess>\w{5})$/;
const matchEngine = /engine=(?<engine>\w+)/;

function handler(req: Request): Response {
  const url = urlParse(req.url);
  if (req.method === "POST" && url.pathname === "/game") {
    const engine = url.search.match(matchEngine)?.groups?.engine;
    const game = makeGame(engine);
    games[game.id] = game;
    const response = new Response(JSON.stringify(game));
    response.headers.set("content-type", "application/json");
    return response;
  } else if (req.method === "GET" && matchGame.test(url.pathname)) {
    const gameId = url.pathname.replace("/game/", "");
    const game = games[gameId];
    if (game) {
      const { word, ...redacted } = game;
      const response = new Response(JSON.stringify(redacted));
      response.headers.set("content-type", "application/json");
      return response;
    }
  } else if (req.method === "PUT" && matchGameAndGuess.test(url.pathname)) {
    const matches = url.pathname.match(matchGameAndGuess)?.groups;

    if (!matches) return new Response("Invalid guess", { status: 400 });

    const { gameId, guess } = matches;
    const { word, ...game } = games[gameId];
    if (game) {
      const feedback = check(word, guess);
      game.guesses.push(guess);
      game.feedback.push(feedback);
      if (word === guess) game.solved = true;

      const response = new Response(JSON.stringify(game));
      response.headers.set("content-type", "application/json");
      return response;
    }
  }

  return new Response(`Not Found`, { status: 404 });
}

serve(handler, { port: 4242 });
