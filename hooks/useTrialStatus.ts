import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/utils/supabase';

export function useTrialStatus() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [trialStatus, setTrialStatus] = useState<{
    isInTrial: boolean;
    trialEndTime: string | null;
  }>({ isInTrial: false, trialEndTime: null });

  useEffect(() => {
    async function checkTrialStatus() {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        // First check if user has an active subscription
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('status')
          .eq('user_id', user.id)
          .maybeSingle();

        // If user has an active subscription, skip trial creation
        if (subscription?.status === 'active' || subscription?.status === 'trialing') {
          setTrialStatus({
            isInTrial: false,
            trialEndTime: null
          });
          setIsLoading(false);
          return;
        }

        // Check if user has an existing trial
        const { data: trial, error: trialError } = await supabase
          .from('user_trials')
          .select('trial_end_time, is_trial_used')
          .eq('user_id', user.id)
          .maybeSingle();

        if (trialError && trialError.code !== 'PGRST116') { // PGRST116 is "not found" error
          throw trialError;
        }

        if (trial) {
          // Set trial as used/expired regardless of time
          setTrialStatus({
            isInTrial: false,
            trialEndTime: trial.trial_end_time
          });
          
          // Mark trial as used if not already
          if (!trial.is_trial_used) {
            await supabase
              .from('user_trials')
              .update({ is_trial_used: true })
              .eq('user_id', user.id);
          }
        } else {
          // No trial exists, but we won't create one
          setTrialStatus({
            isInTrial: false,
            trialEndTime: null
          });
        }
      } catch (error) {
        console.error('Error checking trial status:', error);
        // Set default state on error
        setTrialStatus({
          isInTrial: false,
          trialEndTime: null
        });
      } finally {
        setIsLoading(false);
      }
    }

    checkTrialStatus();
  }, [user?.id]);

  return { ...trialStatus, isLoading };
}