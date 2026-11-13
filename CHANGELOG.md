# Changelog

Versions are major.minor.patch: the patch number for fixes, the minor number
for anything new. Below 1.0.0 Mesmer is a preview, and each release is a GitHub
pre-release with a Windows zip, its SHA-256 in `SHA256SUMS`, and a build
provenance attestation. The first previews were numbered 0.1.0-alpha.1 to
0.1.0-alpha.3; 0.1.0 follows them.

## 0.1.0

The first release numbered major.minor.patch. The plugin flies as 0.1.0-alpha.3 does.

- **New version numbers.** 0.1.0 follows 0.1.0-alpha.3. From now on the patch number goes up for fixes and the minor number for anything new. Below 1.0.0 Mesmer is still a preview, and each release is still a GitHub pre-release. The opening paragraph of [the changelog](CHANGELOG.md) explains the scheme.
- **"Preview" where it said "alpha".** The badge and the warning box near the top of [the README](README.md), the safety paragraph near its end, and the "No warranty" section of [SAFETY.md](SAFETY.md) now call Mesmer preview software. So does the header comment of `config/BrunnerDirect.ini`. The help for `install.ps1 -Tag` now gives `v0.1.0` as its example, and so does the Mesmer version field of the bug report form. Only the wording changed.
- **Release tags.** [The release workflow](.github/workflows/release.yml) now builds only from tags of the form `v<major.minor.patch>`. It stops at any other tag with "is not v<major.minor.patch>".

## 0.1.0-alpha.3

The yoke's buttons now reach X-Plane through vJoy. When Windows has switched the yoke's USB off, the plugin now says so and turns it back on when you click.

- **The yoke's buttons, through vJoy.** The plugin reads the yoke's buttons and presses the matching buttons of vJoy device 1. Bind them in *Settings > Joystick* under `vJoy - Virtual Joystick`. You need to install Brunner's vJoy 2.2.2.0 and set device 1 to 32 buttons and no axes, once. [The yoke's buttons](docs/buttons.md) has the steps and says which button is which. Without vJoy the yoke flies as before, and Log.txt gives the reason after `Yoke buttons off:` ([troubleshooting](docs/troubleshooting.md#the-yokes-buttons-dont-reach-x-plane)).
- **Leave the three panel buttons alone in flight.** Panel buttons 12 to 14 also work the yoke's own menu. On the tested yoke, one press switched its motors on while the plugin was driving it, and the plugin stopped with a fault. Don't bind them.
- **Look down from the yoke.** The new commands `brunner_direct/look_down` and `brunner_direct/look_up` step between ahead, half down and the panel. Ahead is X-Plane's default view. Half down and the panel are Quick Looks 2 and 1, which you save once per aircraft. [The yoke's buttons](docs/buttons.md#commands-worth-a-button) lists these with the plugin's other commands.
- **The yoke's USB switched off in Windows.** Windows keeps a disabled USB bridge off through unplugging, power cycles and restarts. When the yoke's bridge is disabled, the status line now reads *Yoke's USB is off in Windows - click here to turn it on* instead of *Yoke off or unplugged*, even with routine status hidden. Click the line, choose *Plugins > Yoke (Brunner) > Turn the yoke's USB on*, or run `brunner_direct/usb_on`; Windows may ask to allow `pnputil`. While the USB comes back the line reads *Yoke's USB turning on - wait a moment*, and if it is still off after 15 seconds, the offer to turn it on comes back.
- **The HUD's pitch card draws the float.** At rest in cruise, the card drew about 9.5 lb on the yoke where the model, the feel page and the yoke hold none. It now shows the elevator's float in the feel page's green, with words such as "floats 9.7 lb forward". Only the drawing changed; what the plugin sends the yoke did not.
- **The HUD's roll card says yoke.** It used to say wheel. Its lines now read "Saturated · yoke 23% as stiff", "Saturated · yoke under 1% as stiff" and "Force feel off · the yoke is free", the same words as the pitch card.
- **The README on SkunkCrafts Updater.** The updater (version 4 or later) keeps an installed Mesmer current and never overwrites `BrunnerDirect.ini`; the profiles file is replaced with each release. Run updates with X-Plane closed. With X-Plane open, the update stops at the plugin file and leaves the old plugin working; close X-Plane and run the update again.
- **Building from source.** On Windows the plugin now also links cfgmgr32, shell32 and advapi32. You don't need vJoy to build: the plugin loads `vJoyInterface.dll` at run time from the folder vJoy's installer records. The reader reads the button word in every cycle and no longer reads the drives' control position, so the Developer menu's Roll and Pitch lines and the once-a-second Log.txt line no longer show it.

## 0.1.0-alpha.2

The first release built from the public repository, and so the first with a
build provenance attestation. The plugin flies as alpha.1 does.

- **Check where the zip came from.**
  `gh attestation verify Mesmer-0.1.0-alpha.2.zip --repo antialias/mesmer`
  shows GitHub built it from this source. alpha.1 was built while the
  repository was private and has no attestation.
- **Elevator pages: flying slower than it can fly.** On the elevator page, set
  to flying at about 10 kt or less, the elevator ran to a stop as if the air
  came from behind. The page's stand-in for X-Plane let the tail's angle grow
  without limit as the airspeed went. Under 35 kt it now fades into the
  aircraft with no airspeed: the tail in the prop wash alone, the elevator
  hanging on its weight. The feel page and the stall simulator carry the same
  model text. In the aircraft the plugin reads the tail's angle from X-Plane,
  so the yoke was never affected.
- **The README** leads with what Mesmer is: a simulator for each control
  surface and a solver for the yoke.

## 0.1.0-alpha.1

The first public preview: the plugin as it is flown today, published to find
testers and developers. No features were added for it.

**Requirements.** Windows x64, X-Plane 12, and the original Brunner CLS-E yoke
on USB with controller firmware v367. CLS2Sim must be closed. Tested on one
yoke.

**The yoke as a control**

- Pitch and roll in every aircraft, written straight into X-Plane, with no
  bindings to set up and no program beside X-Plane.
- Finds the yoke and keeps looking, once a second, if it is off or
  unplugged.
- Centres the yoke when X-Plane is running steadily and the yoke has been
  still for a second, after showing *Yoke centring - hands off*.
- Carries on by itself through pause and resume, aircraft changes, the yoke
  switched off and on, and the USB cable pulled and replugged.
- After a controller fault, stops the motors and recovers by itself up to
  twice, then asks for one *Retry*.
- One status text, with what is wrong and what to do, in the menu, a
  clickable corner line, the feel card and the feel page.
- Refuses controllers with other firmware before sending anything that
  moves them.

**Force feel (experimental, off by default)**

- Pitch follows a model of the elevator's hinge moment: its weight, the air
  over the tail including propwash, the trim tab, the tail's angle of attack
  and stall, and air from behind.
- Roll follows a model of both ailerons' hinge moments through the wheel's
  linkage, from the air over each wing's own panels.
- A solver sets the drive each update so the yoke rests exactly where the
  model says, with the model's force under your hand up to the drive's own
  limit, kept about 11% under its protection limit.
- Trim moves the yoke's resting point; X-Plane's trim is read, never written.
- Every aircraft flies the Cessna 172 SP's figures from
  `BrunnerDirect.profiles.json`, each with its value, tag and source. The
  file is reread within two seconds of a change.
- Optional stall buffet, off by default and untested with the motors on.

**Seeing and tuning it**

- The feel card in X-Plane: the elevator and ailerons as the plugin sees them.
- The feel page on port 8087 of the local network: the model live, every
  figure as a knob, Save, Undo, Revert, marks, two minutes of history, and
  *Stop yoke motors*.
- Commands for binding: `brunner_direct/stop_motors`, `recenter`,
  `toggle_force_feel`, `force_feel_on`, `force_feel_off`,
  `toggle_status_line`, `pin_hud`, `mark_feel`, `compare_feel`.

**Release defaults.** The yoke waits for your first *Retry* after X-Plane
starts (`auto_start=0`), and force feel is off (`force_feel=0`).

**Known limits.** The yoke's own buttons and hat are not read. The force
calibration (pounds at the grip) is worked out, not measured. Only one
aircraft has its own profile.
