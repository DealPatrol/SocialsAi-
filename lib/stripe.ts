import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-03-25.dahlia' as any,
});

export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    postsPerMonth: 5,
    features: ['5 posts/month', 'Basic AI generation', '3 platforms'],
  },
  pro: {
    name: 'Pro',
    price: 19,
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    postsPerMonth: Infinity,
    features: ['Unlimited posts', 'Priority AI', 'All 13+ platforms', 'Scheduling', 'Analytics'],
  },
  teams: {
    name: 'Teams',
    price: 49,
    priceId: process.env.STRIPE_TEAMS_PRICE_ID,
    postsPerMonth: Infinity,
    features: ['Everything in Pro', '5 team members', 'Shared workspace', 'Priority support'],
  },
};
