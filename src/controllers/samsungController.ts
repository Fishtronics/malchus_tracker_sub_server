import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import {
  moveMouse,
  clickMouse,
  selectAll,
  backspace,
  typeText,
  getArduinoBusy,
  setArduinoBusy
} from '../services/arduinoService';
import { browsers, getActiveBrowser, setActiveBrowser } from '../services/puppeteerService1';

export async function startLogin(req: Request, res: Response) {
  if (getArduinoBusy()) {
    return res.status(429).json({
      status: 'error',
      message: 'Arduino is busy'
    });
  }
  setArduinoBusy(true);

  try {
    const { profileId } = req.body;
    const browser = browsers.get(profileId);
    if (!browser) {
      setArduinoBusy(false);
      return res.status(404).json({
        status: 'error',
        message: 'Browser not found'
      });
    }
    const activeBrowser = getActiveBrowser();
    if (activeBrowser && activeBrowser !== browser) {
      await activeBrowser.minimizeBrowser();
      await browser.maximizeBrowser();
      setActiveBrowser(browser);
    }

    logger.info('Starting login process');

    let signInBtn = null;
    let startTime = Date.now();

    await browser.loadPage('https://smartthingsfind.samsung.com/');

    while (signInBtn === null && Date.now() - startTime < 10000) {
      signInBtn = await browser.getSignInBtnPos();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (signInBtn) {
      await moveMouse(signInBtn.centerX, signInBtn.centerY);
      await clickMouse();
      setArduinoBusy(false);
      return res.status(200).json({
        status: 'success',
        message: 'Successfully clicked sign in button'
      });
    }

    setArduinoBusy(false);
    return res.status(404).json({
      status: 'error',
      message: 'Sign in button not found within timeout'
    });

  } catch (error) {
    setArduinoBusy(false);
    logger.error('Error starting login:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
}

export async function enterEmail(req: Request, res: Response) {
  if (getArduinoBusy()) {
    return res.status(429).json({
      status: 'error',
      message: 'Arduino is busy'
    });
  }
  setArduinoBusy(true);
  try {
    const { email, profileId } = req.body;
    const browser = browsers.get(profileId);
    if (!browser) {
      setArduinoBusy(false);
      return res.status(404).json({
        status: 'error',
        message: 'Browser not found'
      });
    }
    const activeBrowser = getActiveBrowser();
    if (activeBrowser && activeBrowser !== browser) {
      await activeBrowser.minimizeBrowser();
      await browser.maximizeBrowser();
      setActiveBrowser(browser);
    }
    logger.info('Received email:', { email });
    let emailInput = null;
    let startTime = Date.now();

    while (emailInput === null && Date.now() - startTime < 10000) {
      emailInput = await browser.getEmailInputPos();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (emailInput) {
      await moveMouse(emailInput.centerX, emailInput.centerY);
      await clickMouse();
      await selectAll();
      await backspace();
      await typeText(email);
      setArduinoBusy(false);

      let captchaContainer = null;
      await new Promise(async (resolve, reject) => {
        setTimeout(async () => {
          captchaContainer = await browser.checkCaptcha();
          resolve(true);
        }, 1000);
      });

      if (captchaContainer) {
        setArduinoBusy(false);
        return res.status(404).json({
          status: 'error',
          message: 'Captcha container found'
        });
      }

      const nextBtn = await browser.getNextBtnPos();
      if (nextBtn) {
        await moveMouse(nextBtn.centerX, nextBtn.centerY);
        await clickMouse();

        await new Promise(async (resolve, reject) => {
          setTimeout(async () => {
            captchaContainer = await browser.checkCaptcha();
            resolve(true);
          }, 1000);
        });

        setArduinoBusy(false);
        if (captchaContainer) {
          return res.status(404).json({
            status: 'error',
            message: 'Captcha container found'
          });
        }

        return res.status(200).json({
          status: 'success',
          message: 'Successfully entered email'
        });
      }

      setArduinoBusy(false);

      return res.status(404).json({
        status: 'error',
        message: 'Next button not found'
      });
    }

    setArduinoBusy(false);

    return res.status(404).json({
      status: 'error',
      message: 'Email input not found within timeout'
    });

  } catch (error) {
    setArduinoBusy(false);
    logger.error('Error handling email:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
}

export async function enterPassword(req: Request, res: Response) {
  if (getArduinoBusy()) {
    return res.status(429).json({
      status: 'error',
      message: 'Arduino is busy'
    });
  }
  setArduinoBusy(true);

  try {
    const { password, profileId } = req.body;
    const browser = browsers.get(profileId);
    if (!browser) {
      setArduinoBusy(false);
      return res.status(404).json({
        status: 'error',
        message: 'Browser not found'
      });
    }
    const activeBrowser = getActiveBrowser();
    if (activeBrowser && activeBrowser !== browser) {
      await activeBrowser.minimizeBrowser();
      await browser.maximizeBrowser();
      setActiveBrowser(browser);
    }
    logger.info('Received password');
    let passwordInput = null;
    let startTime = Date.now();

    while (passwordInput === null && Date.now() - startTime < 10000) {
      passwordInput = await browser.getPasswordInputPos();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (passwordInput) {
      await moveMouse(passwordInput.centerX, passwordInput.centerY);
      await clickMouse();
      await selectAll();
      await backspace();
      await typeText(password);
      let captchaContainer = null;

      await new Promise(async (resolve, reject) => {
        setTimeout(async () => {
          captchaContainer = await browser.checkCaptcha();
          resolve(true)
        }, 1000);
      });

      if (captchaContainer) {
        setArduinoBusy(false);
        return res.status(404).json({
          status: 'error',
          message: 'Captcha container found'
        });
      }

      const signInBtn = await browser.getSignInBtnPos();
      if (signInBtn) {
        await moveMouse(signInBtn.centerX, signInBtn.centerY);
        await clickMouse();
        
        await new Promise(async (resolve, reject) => {
          setTimeout(async () => {
            captchaContainer = await browser.checkCaptcha();
            resolve(true);
          }, 1000);
        });
        setArduinoBusy(false);
        
        if (captchaContainer) {
          return res.status(404).json({
            status: 'error',
            message: 'Captcha container found'
          });
        }
        return res.status(200).json({
          status: 'success',
          message: 'Successfully entered password'
        });
      }

      setArduinoBusy(false);

      return res.status(404).json({
        status: 'error',
        message: 'Next button not found'
      });
    }

    setArduinoBusy(false);

    return res.status(404).json({
      status: 'error',
      message: 'Password input not found within timeout'
    });

  } catch (error) {
    setArduinoBusy(false);
    logger.error('Error handling password:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
}

export async function changePassword(req: Request, res: Response) {
  if (getArduinoBusy()) {
    return res.status(429).json({
      status: 'error',
      message: 'Arduino is busy'
    });
  }
  setArduinoBusy(true);
  try {
    const { profileId } = req.body;
    const browser = browsers.get(profileId);
    if (!browser) {
      setArduinoBusy(false);
      return res.status(404).json({
        status: 'error',
        message: 'Browser not found'
      });
    }
    const activeBrowser = getActiveBrowser();
    if (activeBrowser && activeBrowser !== browser) {
      await activeBrowser.minimizeBrowser();
      await browser.maximizeBrowser();
      setActiveBrowser(browser);
    }

    logger.info('Starting change password process');

    let signInBtn = null;
    let startTime = Date.now();

    while (signInBtn === null && Date.now() - startTime < 10000) {
      signInBtn = await browser.getNotNowBtnPos();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setArduinoBusy(false);
    if (signInBtn) {
      await moveMouse(signInBtn.centerX, signInBtn.centerY);
      await clickMouse();
      return res.status(200).json({
        status: 'success',
        message: 'Successfully clicked sign in button'
      });
    }

    return res.status(404).json({
      status: 'error',
      message: 'Sign in button not found within timeout'
    });

  } catch (error) {
    setArduinoBusy(false);
    logger.error('Error starting login:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
}

export async function getDevices(req: Request, res: Response) {
  try {
    const { profileId } = req.body;
    const browser = browsers.get(profileId);
    if (!browser) {
      return res.status(404).json({
        status: 'error',
        message: 'Browser not found'
      });
    }
    const activeBrowser = getActiveBrowser();
    if (activeBrowser && activeBrowser !== browser) {
      await activeBrowser.minimizeBrowser();
      await browser.maximizeBrowser();
      setActiveBrowser(browser);
    }

    let deviceList = null;
    let startTime = Date.now();

    while (deviceList === null && Date.now() - startTime < 10000) {
      deviceList = await browser.getDeviceList();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (deviceList) {
      return res.status(200).json({
        status: 'success',
        message: 'Successfully fetched device list',
        data: deviceList.map((device: any, index: number) => ({
          name: device.name,
          id: index
        }))
      });
    }

    return res.status(404).json({
      status: 'error',
      message: 'Device list not found within timeout'
    });
  } catch (error) {
    logger.error('Error fetching device list:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
}

export async function getDeviceDetails(req: Request, res: Response) {
  if (getArduinoBusy()) {
    return res.status(429).json({
      status: 'error',
      message: 'Arduino is busy'
    });
  }
  setArduinoBusy(true);
  try {
    const { deviceName, profileId } = req.body;
    const browser = browsers.get(profileId);
    if (!browser) {
      setArduinoBusy(false);
      return res.status(404).json({
        status: 'error',
        message: 'Browser not found'
      });
    }
    const activeBrowser = getActiveBrowser();
    if (activeBrowser && activeBrowser !== browser) {
      await activeBrowser.minimizeBrowser();
      await browser.maximizeBrowser();
      setActiveBrowser(browser);
    }

    await browser.scrollToDevice(deviceName);
    let deviceList = null;
    let startTime = Date.now();

    while (deviceList === null && Date.now() - startTime < 10000) {
      deviceList = await browser.getDeviceList();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (deviceList) {
      const noticeElement = await browser.getTagNoticePos();
      if (noticeElement) {
        await moveMouse(noticeElement.centerX, noticeElement.centerY);
        await clickMouse();
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      const deviceElement = deviceList.find((device: any) => device.name === deviceName);
      if (deviceElement) {
        await browser.bringToFront();
        await moveMouse(deviceElement.centerX, deviceElement.centerY);
        await clickMouse();
        await new Promise(resolve => setTimeout(resolve, 2000));

        startTime = Date.now();
        let deviceTracked = false;
        while (!deviceTracked && Date.now() - startTime < 10000) {
          deviceTracked = await browser.deviceIsTracked();
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (deviceTracked) {
          const location = await browser.getCurrentLocation();

          if (location) {
            const urlParams = new URLSearchParams(new URL(location).search);
            const llParam = urlParams.get('ll');

            if (llParam) {
              const [latitude, longitude] = llParam.split(',').map(Number);

              const lastUpdatedTime = await browser.getLastUpdatedTime();
              setArduinoBusy(false);
              return res.status(200).json({
                status: 'success',
                message: 'Successfully fetched device location',
                data: { latitude, longitude, lastUpdatedTime }
              });
            } else {
              setArduinoBusy(false);
              return res.status(404).json({
                status: 'error',
                message: 'Location not found'
              });
            }
          } else {
            setArduinoBusy(false);
            return res.status(404).json({
              status: 'error',
              message: 'Location not found'
            });
          }
        } else {
          setArduinoBusy(false);
          return res.status(404).json({
            status: 'error',
            message: 'The device can not be tracked at the moment. Please try again later.'
          })
        }

      } else {
        setArduinoBusy(false);
        return res.status(404).json({
          status: 'error',
          message: 'Device not found'
        });
      }
    } else {
      setArduinoBusy(false);
      return res.status(404).json({
        status: 'error',
        message: 'Device list not found within timeout'
      });
    }
  } catch (error) {
    setArduinoBusy(false);
    logger.error('Error fetching device details:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
}

export async function setDeviceNotifyEmail(req: Request, res: Response) {
  if (getArduinoBusy()) {
    return res.status(429).json({
      status: 'error',
      message: 'Arduino is busy'
    });
  }
  setArduinoBusy(true);
  try {
    const { deviceName, email, profileId } = req.body;
    const browser = browsers.get(profileId);
    if (!browser) {
      setArduinoBusy(false);
      return res.status(404).json({
        status: 'error',
        message: 'Browser not found'
      });
    }
    const activeBrowser = getActiveBrowser();
    if (activeBrowser && activeBrowser !== browser) {
      await activeBrowser.minimizeBrowser();
      await browser.maximizeBrowser();
      setActiveBrowser(browser);
    }

    await browser.scrollToDevice(deviceName);
    let deviceList = null;
    let startTime = Date.now();

    while (deviceList === null && Date.now() - startTime < 10000) {
      deviceList = await browser.getDeviceList();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (deviceList) {
      const deviceElement = deviceList.find((device: any) => device.name === deviceName);
      if (deviceElement) {
        await browser.bringToFront();
        await moveMouse(deviceElement.centerX, deviceElement.centerY);
        await clickMouse();

        let getNotifySettingRadioBtn = null;
        let startTime = Date.now();

        while (getNotifySettingRadioBtn === null && Date.now() - startTime < 40000) {
          getNotifySettingRadioBtn = await browser.getNotifySettingRadioBtnPos();
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (getNotifySettingRadioBtn) {
          const notifyEmailExists = await browser.checkNotifyEmailExists();
          if(notifyEmailExists) {
            setArduinoBusy(false);
            return res.status(200).json({
              status: 'success',
              message: 'Device notify email already exists'
            });
          }
          await moveMouse(getNotifySettingRadioBtn.centerX, getNotifySettingRadioBtn.centerY);
          await clickMouse();

          let getNotifyEmailInput = null;
          let startTime = Date.now();

          while (getNotifyEmailInput === null && Date.now() - startTime < 5000) {
            getNotifyEmailInput = await browser.getNotifyEmailInputPos();
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

          if (getNotifyEmailInput) {
            await moveMouse(getNotifyEmailInput.centerX, getNotifyEmailInput.centerY);
            await clickMouse();
            await selectAll();
            await backspace();
            await typeText(email);

            const getNotifyEmailEnterBtn = await browser.getNotifyEmailEnterBtnPos();
            if (getNotifyEmailEnterBtn) {
              await moveMouse(getNotifyEmailEnterBtn.centerX, getNotifyEmailEnterBtn.centerY);
              await clickMouse();
              setArduinoBusy(false);
              return res.status(200).json({
                status: 'success',
                message: 'Successfully set device notify email'
              });
            } else {
              setArduinoBusy(false);
              return res.status(404).json({
                status: 'error',
                message: 'Notify email enter button not found'
              });
            }
          }
        } else {
          setArduinoBusy(false);
          return res.status(404).json({
            status: 'error',
            message: 'Notify setting radio button not found'
          });
        }
      } else {
        setArduinoBusy(false);
        return res.status(404).json({
          status: 'error',
          message: 'Device not found'
        });
      }
    } else {
      setArduinoBusy(false);
      return res.status(404).json({
        status: 'error',
        message: 'Device not found'
      });
    }
  } catch (error) {
    setArduinoBusy(false);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
}

