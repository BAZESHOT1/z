import { exec } from 'child_process';
import { config } from '../config';

class GitWatcher {
  private interval: NodeJS.Timeout | null = null;

  public start() {
    if (!config.autoUpdateEnabled) return;
    
    console.log('[GitWatcher] Started checking for updates...');
    this.interval = setInterval(() => this.checkForUpdates(), 300000); // каждые 5 минут
  }

  private async checkForUpdates() {
    exec('git fetch origin && git status -uno', (err, stdout) => {
      if (stdout.includes('Your branch is behind')) {
        console.log('[GitWatcher] New version detected! Pulling changes...');
        exec('git pull && docker compose restart backend', (pullErr) => {
          if (!pullErr) console.log('[GitWatcher] Successfully updated and restarted.');
        });
      }
    });
  }
}

export const gitWatcher = new GitWatcher();