#!/usr/bin/env node

import { Command } from 'commander';
import { Client, Server } from 'node-osc';
import * as readline from 'readline';

const program = new Command();

program
  .name('osc-tester')
  .description('OSC sender and receiver CLI tool')
  .version('1.0.1')
  .option('-a, --address <address>', 'IP address', 'localhost')
  .option('-p, --port <port>', 'port number', '9000');

program
  .command('send <oscAddress> <value...>')
  .description('Send OSC message and repeat on Enter, change message by typing new one')
  .action((oscAddress, valueParts, options, command) => {
    const globalOptions = command.parent.opts();
    const address = globalOptions.address;
    const port = parseInt(globalOptions.port);

    const client = new Client(address, port);

    let currentMessage = buildMessage(oscAddress, valueParts);

    console.log(`Sending to ${address}:${port}`);
    console.log(`Initial message: ${JSON.stringify(currentMessage)}`);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> '
    });

    const sendMessage = () => {
      client.send(currentMessage.address, ...currentMessage.args);
      console.log(`Sent: ${currentMessage.address} ${currentMessage.args.join(' ')}`);
    };

    sendMessage();

    rl.on('line', (input) => {
      if (input.trim() === '') {
        sendMessage();
      } else {
        try {
          currentMessage = parseMessageInput(input.trim());
          console.log(`New message set: ${JSON.stringify(currentMessage)}`);
          sendMessage();
        } catch (error) {
          console.error('Invalid message format. Use: /address value or /address,value');
        }
      }
    });

    rl.prompt();
  });

program
  .command('listen')
  .description('Start OSC server and display received messages')
  .action((options, command) => {
    const globalOptions = command.parent.opts();
    const address = globalOptions.address;
    const port = parseInt(globalOptions.port);

    const server = new Server(port, address);

    console.log(`Listening on ${address}:${port}`);

    server.on('message', (msg) => {
      const address = msg[0];
      const args = msg.slice(1);
      const argsStr = args.join(' ');
      console.log(`Received: ${address} ${argsStr}`);
    });
  });

function buildMessage(address, valueParts) {
  const args = Array.isArray(valueParts)
    ? valueParts.map(value => parseValue(value))
    : [parseValue(valueParts)];
  return { address, args };
}

function parseMessageInput(input) {
  if (input.includes(',')) {
    return parseMessageComma(input);
  }

  const parts = input.split(' ').filter(Boolean);
  if (parts.length < 2) {
    throw new Error('Invalid format');
  }

  const address = parts[0].trim();
  const args = parts.slice(1).map(parseValue);
  return { address, args };
}

function parseMessageComma(input) {
  const parts = input.split(',');
  if (parts.length < 1) throw new Error('Invalid format');
  const address = parts[0].trim();
  const args = parts.slice(1)
    .map(arg => arg.trim())
    .filter(arg => arg.length > 0)
    .map(parseValue);
  return { address, args };
}

function parseValue(value) {
  const trimmed = value.trim();
  const num = parseFloat(trimmed);
  return isNaN(num) ? trimmed : num;
}

program.parse();
