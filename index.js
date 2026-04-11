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
  .option('--auto-number', 'Append sequential number to address on each send')
  .description('Send OSC message and repeat on Enter, change message by typing new one')
  .action((oscAddress, valueParts, options, command) => {
    const globalOptions = command.parent.opts();
    const address = globalOptions.address;
    const port = parseInt(globalOptions.port);

    const client = new Client(address, port);

    let currentAddress = oscAddress;
    let currentValues = valueParts;
    let valueIndex = 0;
    let sequenceCounter = 0;

    console.log(`Sending to ${address}:${port}`);
    console.log(`Initial address: ${currentAddress}`);
    console.log(`Initial values: ${currentValues.join(', ')}`);
    if (options.autoNumber) {
      console.log('Auto-numbering enabled: addresses will increment with each send');
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> '
    });

    const sendMessage = () => {
      let finalAddress = currentAddress;
      if (options.autoNumber) {
        if (!finalAddress.endsWith('/')) {
          finalAddress += '/';
        }
        finalAddress += sequenceCounter;
        sequenceCounter++;
      }

      const currentValue = parseValue(currentValues[valueIndex % currentValues.length]);
      client.send(finalAddress, currentValue);
      console.log(`Sent: ${finalAddress} ${currentValue}`);
      valueIndex++;
    };

    sendMessage();

    rl.on('line', (input) => {
      if (input.trim() === '') {
        sendMessage();
      } else {
        try {
          const parsed = parseMessageInput(input.trim());
          currentAddress = parsed.address;
          currentValues = parsed.values;
          valueIndex = 0;
          console.log(`New message set: address=${currentAddress}, values=${currentValues.join(', ')}`);
          sendMessage();
        } catch (error) {
          console.error('Invalid message format. Use: /address value1 value2 ... or /address,value1,value2,...');
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
  const values = parts.slice(1);
  return { address, values };
}

function parseMessageComma(input) {
  const parts = input.split(',');
  if (parts.length < 1) throw new Error('Invalid format');
  const address = parts[0].trim();
  const values = parts.slice(1)
    .map(arg => arg.trim())
    .filter(arg => arg.length > 0);
  return { address, values };
}

function parseValue(value) {
  const trimmed = value.trim();
  const num = parseFloat(trimmed);
  return isNaN(num) ? trimmed : num;
}

program.parse();
