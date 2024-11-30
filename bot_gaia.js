import config from "./config.json" with {type: "json"};
import axios from "axios";
import _ from "lodash";
import fs from "fs";
import {performance} from "perf_hooks";

const args = process.argv.slice(2);
const CHUNK_SIZE = parseInt(args.find(arg => arg.startsWith("--chunk-size="))?.split("=")[1], 10) || 1;

const proceedString = async (string) => {

  const resultString = `${string[0]}${string[1]}${string[2]}`;
  const charsCount = [3, 1];

  const deepProceedString = (chars) => {
    return string
        .substring(chars, string.length - 1)
        .replace(/\\n/g, ' ')
        .replace(/\\n\\n/g, ' ')
        .replace(/\\"/g, '"')
        .replace(/ {2,}/g, " ");
  }

  return deepProceedString((resultString === '": ') ? charsCount[0] : charsCount[1]);
}

async function postToNode(phrase) {
  return new Promise((nodeTaskCompleted, reject) => {
    return axios.post(config.url, {
      messages: [
        {role: "system", content: "You are a helpful assistant."},
        {role: "user", content: phrase}
      ]
    })
        .then(async (response) => {
          try {
            const string = JSON.stringify(response.data["choices"][0].message.content);
            const result = await proceedString(string);
            nodeTaskCompleted(result);
          } catch (error) {
            reject(`${error.message}`);
          }
        })
        .catch(error => {
          reject(`${error.message}`);
        });
  })
}

// (async () => {
//   const phrasesArray = fs.readFileSync(config.pathToFile).toString().split('\n').filter(line => line.trim() !== '');
//   let roundCounter = 0;
//
//   while (true) {
//     const chunks = _.chunk(_.shuffle(phrasesArray), CHUNK_SIZE);
//     for (const chunk of chunks) {
//       const chunkStarted = performance.now();
//       let promises = [];
//       roundCounter++;
//
//       for (const phrase of chunk) {
//         promises.push(
//             postToNode(phrase)
//         )
//       }
//
//       console.info(`>> Round: ${roundCounter} | Requests sent: ${chunk.length}.`);
//       const results = await Promise.all(promises).catch((err) => {
//         console.error(`<< Round: ${roundCounter} | ${err}`);
//       });
//
//       const chunkFinished = performance.now();
//       const elapsed_time = chunkFinished - chunkStarted;
//       console.info(`<< Round: ${roundCounter} | Responses received :: ${chunk.length}. Execution time: ${elapsed_time / 1000} seconds`);
//
//       console.log('_____________________________________________________\n');
//
//       await new Promise(resolve => setTimeout(resolve, 1000));
//     }
//   }
//
// })();

(async () => {
  const phrasesArray = fs.readFileSync(config.pathToFile).toString().split('\n').filter(line => line.trim() !== '');
  let roundCounter = 0;

  while (true) {
    const chunks = _.chunk(_.shuffle(phrasesArray), CHUNK_SIZE);
    for (const chunk of chunks) {
      const chunkStarted = performance.now();
      let promises = [];
      roundCounter++;

      // Iterate over each phrase in the chunk
      for (const phrase of chunk) {
        promises.push(
            postToNode(phrase)
                .then(result => {
                  console.info(`SUCCESS : "${phrase}"`);
                  return result; // Return the result for further processing if needed
                })
                .catch(error => {
                  console.error(`FAIL : "${phrase}": ${error}`);
                  return null; // Return null to ensure Promise.all does not fail
                })
        );
      }

      console.info(`>> Round: ${roundCounter} | Requests sent: ${chunk.length}.`);
      const results = await Promise.all(promises); // Wait for all promises to resolve

      // Optionally process results after Promise.all
      // results.forEach((result, index) => {
      //   if (result === null) {
      //     console.info(`Failed to process phrase: "${chunk[index]}"`);
      //   } else {
      //     console.info(`Result for phrase: "${chunk[index]}": ${result}`);
      //   }
      // });

      const chunkFinished = performance.now();
      const elapsed_time = chunkFinished - chunkStarted;
      console.info(`<< Round: ${roundCounter} | Responses received :: ${chunk.length}. Execution time: ${elapsed_time / 1000} seconds`);

      console.log('_____________________________________________________\n');

      await new Promise(resolve => setTimeout(resolve, 1000)); // Pause before the next chunk
    }
  }
})()