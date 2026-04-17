const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const generator = require('../../../scripts/generator/create-app');

class SystemActionsService {
  async runCommand(commandId) {
    const isWindows = process.platform === 'win32';
    const npmCmd = isWindows ? 'npm.cmd' : 'npm';

    const commands = {
      seed: `${npmCmd} run seed`,
      purge: `${npmCmd} run purge`,
      backup: `${npmCmd} run backup:mongo`,
      swagger: `${npmCmd} run swagger:reset`,
      restart: 'node -e "const fs = require(\'fs\'); fs.utimesSync(\'server.js\', new Date(), new Date()); process.exit(0);"',
    };

    const command = commands[commandId];
    if (!command) {
      throw new Error(`Commande inconnue : ${commandId}`);
    }

    return new Promise((resolve) => {
      exec(command, { 
        cwd: path.join(__dirname, '../../../'),
        maxBuffer: 1024 * 1024 * 5 // 5MB buffer for large outputs (like seed)
      }, (error, stdout, stderr) => {
        if (error) {
          return resolve({
            success: false,
            message: `Échec de la commande ${commandId} : ${error.message}`,
            output: stderr || error.message,
          });
        }
        resolve({
          success: true,
          message: `Commande ${commandId} exécutée avec succès`,
          output: stdout,
        });
      });
    });
  }

  async createApp(appName, templateKey, addons = {}) {
    let templateFeatures = [];
    let templateName = 'Personnalisé';

    if (templateKey && templateKey !== 'custom' && templateKey !== 'expert') {
      const template = generator.PROFESSIONAL_TEMPLATES[templateKey];
      if (!template) {
        throw new Error(`Template inconnu : ${templateKey}`);
      }
      templateFeatures = template.features;
      templateName = template.name;
    } else if (templateKey === 'custom') {
      // Mode sélection rapide : on mappe les noms de features aux structures prédéfinies
      const selectedNames = addons.features || [];
      templateFeatures = [];
      
      // On cherche dans tous les templates pour trouver la feature correspondante
      selectedNames.forEach(name => {
        for (const tpl of Object.values(generator.PROFESSIONAL_TEMPLATES)) {
          const found = tpl.features.find(f => f.name === name);
          if (found) {
            templateFeatures.push(found);
            break;
          }
        }
      });
      
      delete addons.features;
      templateName = 'Sélection Rapide';
    } else if (templateKey === 'expert') {
      // Mode expert : les features sont déjà des objets complets
      templateFeatures = addons.features || [];
      delete addons.features;
      templateName = 'Architecture Expert';
    }

    // Capture des logs de console.log pour les renvoyer au client
    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => {
      logs.push(args.map(a => String(a).replace(/\x1b\[[0-9;]*m/g, '')).join(' ')); // Strip ANSI colors
      originalLog.apply(console, args);
    };

    try {
      // Map exportData to export if present
      if (addons.exportData !== undefined) {
        addons.export = addons.exportData;
      }

      const success = await generator.createApp({
        name: appName,
        features: templateFeatures,
        ultraPro: true,
        addons: addons,
        askAddons: false,
      });

      // Restaurer console.log
      console.log = originalLog;

      if (success) {
        return {
          success: true,
          message: `Application ${appName} générée avec succès via le template ${templateName}`,
          output: logs.join('\n'),
        };
      } else {
        return {
          success: false,
          message: `Échec de la génération de l'application ${appName}`,
          output: logs.join('\n'),
        };
      }
    } catch (error) {
      // Restaurer console.log en cas d'erreur
      console.log = originalLog;
      return {
        success: false,
        message: `Erreur critique lors de la génération : ${error.message}`,
        output: logs.join('\n'),
      };
    }
  }
}

module.exports = new SystemActionsService();
