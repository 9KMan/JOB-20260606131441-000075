import { Router, Request, Response } from 'express';
import { BrokerConnector } from '../broker/connector.js';
import { BrokerRestClient } from '../broker/rest-client.js';

export function createBrokerRoutes(
  connector: BrokerConnector,
  restClient: BrokerRestClient
): Router {
  const router = Router();

  // Initiate OAuth
  router.post('/connect', async (req: Request, res: Response) => {
    const { redirectUri } = req.body as { redirectUri?: string };
    if (!redirectUri) {
      res.status(400).json({ error: 'redirectUri required' });
      return;
    }
    const url = await connector.getAuthorizationUrl(redirectUri);
    res.json({ authorizationUrl: url });
  });

  // Exchange OAuth code
  router.post('/exchange', async (req: Request, res: Response) => {
    const { code, redirectUri } = req.body as { code?: string; redirectUri?: string };
    if (!code || !redirectUri) {
      res.status(400).json({ error: 'code and redirectUri required' });
      return;
    }
    await connector.exchangeCodeForTokens(code, redirectUri);
    res.json({ success: true });
  });

  // Provision account
  router.post('/accounts', async (req: Request, res: Response) => {
    const { name, email } = req.body as { name?: string; email?: string };
    if (!name || !email) {
      res.status(400).json({ error: 'name and email required' });
      return;
    }
    const account = await restClient.provisionAccount(name, email);
    res.json({ account });
  });

  // Get positions
  router.get('/positions/:accountId', async (req: Request, res: Response) => {
    const { accountId } = req.params;
    const positions = await restClient.getPositions(accountId);
    res.json({ positions });
  });

  // Get risk status
  router.get('/risk-status/:accountId', async (req: Request, res: Response) => {
    const { accountId } = req.params;
    const status = await restClient.getRiskStatus(accountId);
    res.json({ status });
  });

  // Trigger liquidation
  router.post('/liquidate', async (req: Request, res: Response) => {
    const { accountId, reason, breachType } = req.body as {
      accountId?: string; reason?: string; breachType?: string;
    };
    if (!accountId || !reason || !breachType) {
      res.status(400).json({ error: 'accountId, reason, breachType required' });
      return;
    }
    await restClient.triggerLiquidation({ accountId, reason, breachType: breachType as import('../broker/types.js').BreachType });
    res.json({ success: true });
  });

  // Reset account
  router.post('/reset/:accountId', async (req: Request, res: Response) => {
    const { accountId } = req.params;
    await restClient.resetAccount(accountId);
    res.json({ success: true });
  });

  return router;
}