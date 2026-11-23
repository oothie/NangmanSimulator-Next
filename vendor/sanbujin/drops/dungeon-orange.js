/* Static replay of the reference dungeon entry sequences. */
(function () {
  'use strict';
  function route1(s) {
    if (s.draw('seed_dcy_40373', 1000) - s.get('win_dcy')*2 <= 50  && s.get('drop_4820_40373') === 0) {
      s.set("drop_4820_40373", 1);
    } else {
      s.set("drop_4820_40373", 0);
    }
    if (s.draw('seed_dcy_40373', 1000) - s.get('win_dcy') <= 40  && s.get('drop_9072_40373') === 0) {
      s.set("drop_9072_40373", 1);
    } else {
      s.set("drop_9072_40373", 0);
    }
    if (s.draw('seed_dcy_40373', 1000) - s.get('roll_2926_40373') < 300) {
      s.set("drop_2926_40373", 1);
      s.add("roll_2926_40373", -700);
    } else {
      s.add("roll_2926_40373", 400);
      s.set("drop_2926_40373", 0);
    }
    switch (s.pick("seed_dcy_40373", [40373,40373,200,40373,40373,40373,40373])) {
      case 0:
        s.add("num_2002_40373", 1);
        s.set("name_drop_40373", 2002);
        break;
      case 1:
        s.add("num_2000_40373", 1);
        s.set("name_drop_40373", 2000);
        break;
      case 2:
        s.set("name_drop_40373", 0);
        break;
      case 3:
        s.add("num_3025_40373", 1);
        s.set("name_drop_40373", 3025);
        break;
      case 4:
        s.add("num_2001_40373", 1);
        s.set("name_drop_40373", 2001);
        break;
      case 5:
        s.add("num_3029_40373", 1);
        s.set("name_drop_40373", 3029);
        break;
      case 6:
        s.add("num_3030_40373", 1);
        s.set("name_drop_40373", 3030);
        break;
    }
    switch (s.pick("seed_dcy_40373", [50,50])) {
      case 0:
        s.set("drop_40373_equip", s.draw('seed_dcy_40373', 5));
        switch (s.pick("seed_dcy_40373", [50,5,15,30])) {
          case 0:
            s.set("drop_40373_color", 1);
            break;
          case 1:
            s.set("drop_40373_color", 4);
            break;
          case 2:
            s.set("drop_40373_color", 3);
            break;
          case 3:
            s.set("drop_40373_color", 2);
            break;
        }
        break;
      case 1:
        s.set("drop_40373_equip", 0);
        break;
    }
  }

  function route2(s) {
    if (s.get('win_ywf') >= 12 && s.draw('seed_33652', 1000) - s.get('win_ywf') <= 50  && s.get('drop_2364_33652') === 0) {
      s.set("drop_2364_33652", 1);
    } else {
      s.set("drop_2364_33652", 0);
    }
    if (s.draw('seed_33652', 1000) - s.get('roll_2918_33652') < 400) {
      s.set("drop_2918_33652", 1);
      s.add("roll_2918_33652", -600);
    } else {
      s.add("roll_2918_33652", 400);
      s.set("drop_2918_33652", 0);
    }
    if (s.get('win_ywf') >= 10 && s.draw('seed_33652', 1000) - s.get('win_ywf')*2 <= 50  && s.get('drop_5618_33652') === 0) {
      s.set("drop_5618_33652", 1);
    } else {
      s.set("drop_5618_33652", 0);
    }
    switch (s.pick("seed_33652", [50,10,40])) {
      case 0:
        s.set("drop_33652_equip", s.draw('seed_33652', 5));
        s.set("drop_3505_33652", 0);
        switch (s.pick("seed_33652", [50,5,15,30])) {
          case 0:
            s.set("drop_33652_color", 1);
            break;
          case 1:
            s.set("drop_33652_color", 4);
            break;
          case 2:
            s.set("drop_33652_color", 3);
            break;
          case 3:
            s.set("drop_33652_color", 2);
            break;
        }
        break;
      case 1:
        s.set("drop_3505_33652", 1);
        s.set("drop_33652_equip", 0);
        break;
      case 2:
        s.set("drop_33652_equip", 0);
        s.set("drop_3505_33652", 0);
        break;
    }
  }

  function route3(s) {
    if (s.draw('seed_trm', 1000) - s.get('win_trm')*5 <= 70  && s.get('drop_4418_40172') === 0) {
      s.set("drop_4418_40172", 1);
    } else {
      s.set("drop_4418_40172", 0);
    }
    switch (s.pick("seed_trm", [50,50])) {
      case 0:
        s.set("drop_40172_equip", s.draw('seed_trm', 4));
        break;
      case 1:
        s.set("drop_40172_equip", 0);
        break;
    }
    switch (s.pick("seed_trm", [50,5,15,30])) {
      case 0:
        s.set("drop_40172_color", 1);
        break;
      case 1:
        s.set("drop_40172_color", 4);
        break;
      case 2:
        s.set("drop_40172_color", 3);
        break;
      case 3:
        s.set("drop_40172_color", 2);
        break;
    }
    if (s.draw('seed_trm', 100) - s.get('win_trm') <= 4  && s.get('drop_4419_40171') === 0) {
      s.set("drop_4419_40171", 1);
    } else {
      s.set("drop_4419_40171", 0);
    }
    if (s.draw('seed_trm', 100) - s.get('win_trm') <= 25  && s.get('drop_3825_40171') === 0) {
      s.set("drop_3825_40171", 1);
    } else {
      s.set("drop_3825_40171", 0);
    }
    if (s.draw('seed_trm', 100) - s.get('roll_2995_40171') < 45) {
      s.set("drop_2995_40171", 1);
      s.add("roll_2995_40171", -55);
    } else {
      s.add("roll_2995_40171", 45);
      s.set("drop_2995_40171", 0);
    }
    switch (s.pick("seed_trm", [50,50])) {
      case 0:
        s.set("drop_40171_equip", s.draw('seed_trm', 4));
        break;
      case 1:
        s.set("drop_40171_equip", 0);
        break;
    }
    switch (s.pick("seed_trm", [50,5,15,30])) {
      case 0:
        s.set("drop_40171_color", 1);
        break;
      case 1:
        s.set("drop_40171_color", 4);
        break;
      case 2:
        s.set("drop_40171_color", 3);
        break;
      case 3:
        s.set("drop_40171_color", 2);
        break;
    }
    if (s.draw('seed_trm', 100) - s.get('roll_2994_40170') < 40) {
      s.set("drop_2994_40170", 1);
      s.add("roll_2994_40170", -60);
    } else {
      s.add("roll_2994_40170", 40);
      s.set("drop_2994_40170", 0);
    }
    if (s.draw('seed_trm', 1000) - s.get('win_trm') <= 20  && s.get('drop_7212_40170') === 0) {
      s.set("drop_7212_40170", 1);
    } else {
      s.set("drop_7212_40170", 0);
    }
    if (s.draw('seed_trm', 1000) - s.get('win_trm') <= 1000  && s.branch('jwg_zhenpai_jwj') === 1 && s.get('drop_6559_40170') === 0) {
      s.set("drop_6559_40170", 1);
    } else {
      s.set("drop_6559_40170", 0);
    }
    switch (s.pick("seed_trm", [50,50])) {
      case 0:
        s.set("drop_40170_equip", s.draw('seed_trm', 6));
        break;
      case 1:
        s.set("drop_40170_equip", 0);
        break;
    }
    switch (s.pick("seed_trm", [50,5,15,30])) {
      case 0:
        s.set("drop_40170_color", 1);
        break;
      case 1:
        s.set("drop_40170_color", 4);
        break;
      case 2:
        s.set("drop_40170_color", 3);
        break;
      case 3:
        s.set("drop_40170_color", 2);
        break;
    }
  }

  function route4(s) {
    switch (s.pick("seed_tyj", [40,10,50])) {
      case 0:
        s.set("drop_33858_equip", s.draw('seed_tyj', 3));
        s.set("drop_33858_weapon", 0);
        break;
      case 1:
        s.set("drop_33858_weapon", 1);
        s.set("drop_33858_equip", 0);
        break;
      case 2:
        s.set("drop_33858_weapon", 0);
        s.set("drop_33858_equip", 0);
        break;
    }
    switch (s.pick("seed_tyj", [50,5,15,30])) {
      case 0:
        s.set("drop_33858_color", 1);
        break;
      case 1:
        s.set("drop_33858_color", 4);
        break;
      case 2:
        s.set("drop_33858_color", 3);
        break;
      case 3:
        s.set("drop_33858_color", 2);
        break;
    }
    if (s.draw('seed_tyj', 1000) -  s.get('win_tyj')*4 <= 50 && s.get('drop_4217_33858') === 0) {
      s.set("drop_4217_33858", 1);
    } else {
      s.set("drop_4217_33858", 0);
    }
    switch (s.pick("seed_tyj", [40,10,50])) {
      case 0:
        s.set("drop_33860_equip", s.draw('seed_tyj', 3));
        s.set("drop_33860_weapon", 0);
        break;
      case 1:
        s.set("drop_33860_weapon", 1);
        s.set("drop_33860_equip", 0);
        break;
      case 2:
        s.set("drop_33860_weapon", 0);
        s.set("drop_33860_equip", 0);
        break;
    }
    switch (s.pick("seed_tyj", [50,5,15,30])) {
      case 0:
        s.set("drop_33860_color", 1);
        break;
      case 1:
        s.set("drop_33860_color", 4);
        break;
      case 2:
        s.set("drop_33860_color", 3);
        break;
      case 3:
        s.set("drop_33860_color", 2);
        break;
    }
    if (s.draw('seed_tyj', 1000) -  s.get('win_tyj')*4 <= 50 && s.get('drop_4619_33860') === 0) {
      s.set("drop_4619_33860", 1);
    } else {
      s.set("drop_4619_33860", 0);
    }
    if (s.draw('seed_tyj', 1000) - s.get('win_tyj')*4 <= 80 && s.get('drop_4817_33860') === 0) {
      s.set("drop_4817_33860", 1);
    } else {
      s.set("drop_4817_33860", 0);
    }
    switch (s.pick("seed_tyj", [40,10,50])) {
      case 0:
        s.set("drop_33861_equip", s.draw('seed_tyj', 3));
        s.set("drop_33861_weapon", 0);
        break;
      case 1:
        s.set("drop_33861_weapon", 1);
        s.set("drop_33861_equip", 0);
        break;
      case 2:
        s.set("drop_33861_weapon", 0);
        s.set("drop_33861_equip", 0);
        break;
    }
    switch (s.pick("seed_tyj", [50,5,15,30])) {
      case 0:
        s.set("drop_33861_color", 1);
        break;
      case 1:
        s.set("drop_33861_color", 4);
        break;
      case 2:
        s.set("drop_33861_color", 3);
        break;
      case 3:
        s.set("drop_33861_color", 2);
        break;
    }
    if (s.draw('seed_tyj', 1000) - s.get('win_tyj')*4 <= 80 && s.get('drop_5211_33861') === 0) {
      s.set("drop_5211_33861", 1);
    } else {
      s.set("drop_5211_33861", 0);
    }
    if (s.draw('seed_tyj', 100) - s.get('roll_2914_33861') < 45) {
      s.set("drop_2914_33861", 1);
      s.add("roll_2914_33861", -55);
    } else {
      s.add("roll_2914_33861", 45);
      s.set("drop_2914_33861", 0);
    }
    switch (s.pick("seed_tyj", [40,10,50])) {
      case 0:
        s.set("drop_33862_equip", s.draw('seed_tyj', 5));
        s.set("drop_33862_weapon", 0);
        break;
      case 1:
        s.set("drop_33862_weapon", s.draw('seed_tyj', 4));
        s.set("drop_33862_equip", 0);
        break;
      case 2:
        s.set("drop_33862_weapon", 0);
        s.set("drop_33862_equip", 0);
        break;
    }
    switch (s.pick("seed_tyj", [50,5,15,30])) {
      case 0:
        s.set("drop_33862_color", 1);
        break;
      case 1:
        s.set("drop_33862_color", 4);
        break;
      case 2:
        s.set("drop_33862_color", 3);
        break;
      case 3:
        s.set("drop_33862_color", 2);
        break;
    }
    if (s.draw('seed_tyj', 1000) - s.get('win_tyj') <= 10 && s.get('drop_7033_33862') === 0) {
      s.set("drop_7033_33862", 1);
    } else {
      s.set("drop_7033_33862", 0);
    }
    if (s.draw('seed_tyj', 100) - s.get('roll_2915_33862') < 45) {
      s.set("drop_2915_33862", 1);
      s.add("roll_2915_33862", -55);
    } else {
      s.add("roll_2915_33862", 45);
      s.set("drop_2915_33862", 0);
    }
    if (s.draw('seed_tyj', 100) <= 30+s.get('tyj_seef_drlj') && s.branch('ty_xiaoqingshenshi') === 4 && s.get('drop_6443_33862') === 0) {
      s.set("drop_6443_33862", 1);
    } else {
      s.set("drop_6443_33862", 0);
      s.add("tyj_seef_drlj", 30);
    }
  }

  function route5(s) {
    if (s.get('win_byj')> 2 && s.draw('seed_byj', 1000) - s.get('win_byj') <= 70 && s.get('drop_7264_35219') === 0) {
      s.set("drop_7264_35219", 1);
    } else {
      s.set("drop_7264_35219", 0);
    }
    if (s.draw('seed_byj', 1000) - s.get('win_byj') <= 70  && s.get('drop_7265_35219') === 0) {
      s.set("drop_7265_35219", 1);
    } else {
      s.set("drop_7265_35219", 0);
    }
    switch (s.pick("seed_byj", [50,50])) {
      case 0:
        s.set("drop_35219_equip", s.draw('seed_byj', 4));
        break;
      case 1:
        s.set("drop_35219_equip", 0);
        break;
    }
    switch (s.pick("seed_byj", [50,5,15,30])) {
      case 0:
        s.set("drop_35219_color", 1);
        break;
      case 1:
        s.set("drop_35219_color", 4);
        break;
      case 2:
        s.set("drop_35219_color", 3);
        break;
      case 3:
        s.set("drop_35219_color", 2);
        break;
    }
    if (s.draw('seed_byj', 100) - s.get('roll_2922_35214') < 45) {
      s.set("drop_2922_35214", 1);
      s.add("roll_2922_35214", -55);
    } else {
      s.add("roll_2922_35214", 45);
      s.set("drop_2922_35214", 0);
    }
    if (s.get('win_byj')>10 && s.draw('seed_byj', 1000) - s.get('win_byj') <= 50  && s.get('drop_7262_35214') === 0) {
      s.set("drop_7262_35214", 1);
    } else {
      s.set("drop_7262_35214", 0);
    }
    if (s.get('win_byj')>10 && s.draw('seed_byj', 1000) - s.get('win_byj') <= 50  && s.get('drop_7263_35214') === 0) {
      s.set("drop_7263_35214", 1);
    } else {
      s.set("drop_7263_35214", 0);
    }
    switch (s.pick("seed_byj", [50,50])) {
      case 0:
        s.set("drop_35214_equip", s.draw('seed_byj', 4));
        break;
      case 1:
        s.set("drop_35214_equip", 0);
        break;
    }
    switch (s.pick("seed_byj", [50,5,15,30])) {
      case 0:
        s.set("drop_35214_color", 1);
        break;
      case 1:
        s.set("drop_35214_color", 4);
        break;
      case 2:
        s.set("drop_35214_color", 3);
        break;
      case 3:
        s.set("drop_35214_color", 2);
        break;
    }
    if (s.draw('seed_byj', 100) - s.get('roll_2923_35221') < 45) {
      s.set("drop_2923_35221", 1);
      s.add("roll_2923_35221", -55);
    } else {
      s.add("roll_2923_35221", 45);
      s.set("drop_2923_35221", 0);
    }
    if (s.get('win_byj')> 5 && s.draw('seed_byj', 1000) - s.get('win_byj') <= 50  && s.get('drop_7267_35221') === 0) {
      s.set("drop_7267_35221", 1);
    } else {
      s.set("drop_7267_35221", 0);
    }
    if (s.draw('seed_byj', 1000) - s.get('win_byj') <= 100  && s.get('drop_7266_35221') === 0) {
      s.set("drop_7266_35221", 1);
    } else {
      s.set("drop_7266_35221", 0);
    }
    if (s.get('win_byj') >= 10 && s.branch('byj_bz')<0 && s.get('glm_open')===0) {
      if (s.draw('seed_byj', 100)-s.get('roll_3970_35221') < 10) {
        s.set("drop_3970_35221", 1);
        s.add("roll_3970_35221", -70);
      } else {
        s.add("roll_3970_35221", 10);
        s.set("drop_3970_35221", 0);
      }
    }
    switch (s.pick("seed_byj", [50,50])) {
      case 0:
        s.set("drop_35221_equip", s.draw('seed_byj', 4));
        break;
      case 1:
        s.set("drop_35221_equip", 0);
        break;
    }
    switch (s.pick("seed_byj", [50,5,15,30])) {
      case 0:
        s.set("drop_35221_color", 1);
        break;
      case 1:
        s.set("drop_35221_color", 4);
        break;
      case 2:
        s.set("drop_35221_color", 3);
        break;
      case 3:
        s.set("drop_35221_color", 2);
        break;
    }
  }

  function route6(s) {
    if (s.draw('seed_dcy_40374', 1000) - s.get('win_dcy')*2 <= 50  && s.get('drop_5218_40374') === 0) {
      s.set("drop_5218_40374", 1);
    } else {
      s.set("drop_5218_40374", 0);
    }
    if (s.draw('seed_dcy_40374', 1000) - s.get('win_dcy') <= 40  && s.get('drop_9072_40374') === 0) {
      s.set("drop_9072_40374", 1);
    } else {
      s.set("drop_9072_40374", 0);
    }
    if (s.draw('seed_dcy_40374', 1000) - s.get('win_dcy') <= 40  && s.get('drop_8295_40374') === 0) {
      s.set("drop_8295_40374", 1);
    } else {
      s.set("drop_8295_40374", 0);
    }
    if (s.draw('seed_dcy_40374', 1000) - s.get('win_dcy') <= 20  && s.get('drop_7165_40374') === 0) {
      s.set("drop_7165_40374", 1);
    } else {
      s.set("drop_7165_40374", 0);
    }
    if (s.draw('seed_dcy_40374', 1000) - s.get('roll_2925_40374') < 400) {
      s.set("drop_2925_40374", 1);
      s.add("roll_2925_40374", -600);
    } else {
      s.add("roll_2925_40374", 400);
      s.set("drop_2925_40374", 0);
    }
    switch (s.pick("seed_dcy_40374", [50,50])) {
      case 0:
        s.set("drop_40374_equip", s.draw('seed_dcy_40374', 5));
        switch (s.pick("seed_dcy_40374", [50,5,15,30])) {
          case 0:
            s.set("drop_40374_color", 1);
            break;
          case 1:
            s.set("drop_40374_color", 4);
            break;
          case 2:
            s.set("drop_40374_color", 3);
            break;
          case 3:
            s.set("drop_40374_color", 2);
            break;
        }
        break;
      case 1:
        s.set("drop_40374_equip", 0);
        break;
    }
  }

  function route7(s) {
    if (s.get('win_lsby')> 6 && s.draw('seed_lsby', 1000) - s.get('win_lsby') <= 50 && s.get('drop_5020_35260') === 0) {
      s.set("drop_5020_35260", 1);
    } else {
      s.set("drop_5020_35260", 0);
    }
    switch (s.pick("seed_lsby", [50,50])) {
      case 0:
        s.set("drop_35260_equip", s.draw('seed_lsby', 3));
        break;
      case 1:
        s.set("drop_35260_equip", 0);
        break;
    }
    switch (s.pick("seed_lsby", [40,5,15,40])) {
      case 0:
        s.set("drop_35260_color", 2);
        break;
      case 1:
        s.set("drop_35260_color", 4);
        break;
      case 2:
        s.set("drop_35260_color", 3);
        break;
      case 3:
        s.set("drop_35260_color", 1);
        break;
    }
    if (s.get('win_lsby') > 12 && s.draw('seed_lsby', 100) - s.get('roll_8913_35264') < 40) {
      s.set("drop_8913_35264", 1);
      s.add("roll_8913_35264", -60);
    } else {
      s.add("roll_8913_35264", 40);
      s.set("drop_8913_35264", 0);
    }
    if (s.get('win_lsby')>8 && s.draw('seed_lsby', 1000) - s.get('win_lsby') <= 50  && s.get('drop_5628_35264') === 0) {
      s.set("drop_5628_35264", 1);
    } else {
      s.set("drop_5628_35264", 0);
    }
    if (s.get(8915) === 0 && s.get('win_lsby') > 10) {
      if (s.draw('seed_lsby', 100, '고리의 열쇠 추첨 · 8915')-s.get('roll_8915_35264') < 20) {
        s.set("drop_8915_35264", 1);
        s.add("roll_8915_35264", -80);
      } else {
        s.add("roll_8915_35264", 20);
        s.set("drop_8915_35264", 0);
      }
    }
    switch (s.pick("seed_lsby", [6,3,8,5,2,11,1,7,4,9,10])) {
      case 0:
        s.add("num_2606_lsby", 1);
        s.set("name_drop_a", 2606);
        break;
      case 1:
        s.add("num_2603_lsby", 1);
        s.set("name_drop_a", 2603);
        break;
      case 2:
        s.add("num_2618_lsby", 1);
        s.set("name_drop_a", 2618);
        break;
      case 3:
        s.add("num_2605_lsby", 1);
        s.set("name_drop_a", 2605);
        break;
      case 4:
        s.add("num_2602_lsby", 1);
        s.set("name_drop_a", 2602);
        break;
      case 5:
        s.add("num_2627_lsby", 1);
        s.set("name_drop_a", 2627);
        break;
      case 6:
        s.add("num_2601_lsby", 1);
        s.set("name_drop_a", 2601);
        break;
      case 7:
        s.add("num_2617_lsby", 1);
        s.set("name_drop_a", 2617);
        break;
      case 8:
        s.add("num_2604_lsby", 1);
        s.set("name_drop_a", 2604);
        break;
      case 9:
        s.add("num_2619_lsby", 1);
        s.set("name_drop_a", 2619);
        break;
      case 10:
        s.add("num_2620_lsby", 1);
        s.set("name_drop_a", 2620);
        break;
    }
    switch (s.pick("seed_lsby", [304,303,302,301])) {
      case 0:
        s.set("name_drop_b", 8805);
        s.set("name_drop_b_num", 2);
        break;
      case 1:
        s.set("name_drop_b", 8804);
        s.set("name_drop_b_num", 2);
        break;
      case 2:
        s.set("name_drop_b", 8803);
        s.set("name_drop_b_num", 2);
        break;
      case 3:
        s.set("name_drop_b", 8802);
        s.set("name_drop_b_num", 3);
        break;
    }
    switch (s.pick("seed_lsby", [200,200,201,200,200])) {
      case 0:
        s.set("name_drop_c", 3029);
        s.set("name_drop_c_num", 6);
        break;
      case 1:
        s.set("name_drop_c", 3035);
        s.set("name_drop_c_num", 4);
        break;
      case 2:
        s.set("name_drop_c", 3025);
        s.set("name_drop_c_num", 4);
        break;
      case 3:
        s.set("name_drop_c", 3028);
        s.set("name_drop_c_num", 12);
        break;
      case 4:
        s.set("name_drop_c", 3030);
        s.set("name_drop_c_num", 2);
        break;
    }
    s.set("name_drop_mishiloc", 2000 + s.draw('seed_lsby', 3));
    switch (s.pick("seed_lsby", [50,50])) {
      case 0:
        s.set("drop_35264_equip", s.draw('seed_lsby', 4));
        break;
      case 1:
        s.set("drop_35264_equip", 0);
        break;
    }
    switch (s.pick("seed_lsby", [50,5,15,30])) {
      case 0:
        s.set("drop_35264_color", 1);
        break;
      case 1:
        s.set("drop_35264_color", 4);
        break;
      case 2:
        s.set("drop_35264_color", 3);
        break;
      case 3:
        s.set("drop_35264_color", 2);
        break;
    }
    if (s.get('win_lsby')> 20 && s.draw('seed_lsby', 100) - s.get('roll_8914_35268') < 45) {
      s.set("drop_8914_35268", 1);
      s.add("roll_8914_35268", -55);
    } else {
      s.add("roll_8914_35268", 45);
      s.set("drop_8914_35268", 0);
    }
    if (s.get('win_lsby')> 12 && s.draw('seed_lsby', 100) - s.get('roll_8917_35268') < 30) {
      s.set("drop_8917_35268", 1);
      s.add("roll_8917_35268", -70);
    } else {
      s.add("roll_8917_35268", 30);
      s.set("drop_8917_35268", 0);
    }
    switch (s.pick("seed_lsby", [35268,120])) {
      case 0:
        s.set("drop_35268_material", 1);
        s.set("roll_35268", 0);
        break;
      case 1:
        s.set("drop_35268_material", 0);
        s.add("roll_35268", 40);
        break;
    }
    switch (s.pick("seed_lsby", [50,50])) {
      case 0:
        s.set("drop_35268_equip", s.draw('seed_lsby', 4));
        break;
      case 1:
        s.set("drop_35268_equip", 0);
        break;
    }
    switch (s.pick("seed_lsby", [50,5,15,30])) {
      case 0:
        s.set("drop_35268_color", 1);
        break;
      case 1:
        s.set("drop_35268_color", 4);
        break;
      case 2:
        s.set("drop_35268_color", 3);
        break;
      case 3:
        s.set("drop_35268_color", 2);
        break;
    }
  }

  function route8(s) {
    if (s.get('win_byjzt') >= 6 && s.draw('seed_byjzt', 1000) - s.get('win_byjzt') <= 100 && s.get('drop_5427_50883') === 0) {
      s.set("drop_5427_50883", 1);
    } else {
      s.set("drop_5427_50883", 0);
    }
    switch (s.pick("seed_byjzt", [50,50])) {
      case 0:
        s.set("drop_50883_equip", s.draw('seed_byjzt', 4));
        break;
      case 1:
        s.set("drop_50883_equip", 0);
        break;
    }
    switch (s.pick("seed_byjzt", [50,5,15,30])) {
      case 0:
        s.set("drop_50883_color", 1);
        break;
      case 1:
        s.set("drop_50883_color", 4);
        break;
      case 2:
        s.set("drop_50883_color", 3);
        break;
      case 3:
        s.set("drop_50883_color", 2);
        break;
    }
    if (s.get('win_byjzt') >= 10 && s.draw('seed_byjzt', 1000) - s.get('win_byjzt') <= 100 && s.get('drop_5223_50910') === 0) {
      s.set("drop_5223_50910", 1);
    } else {
      s.set("drop_5223_50910", 0);
    }
    if (s.draw('seed_byjzt', 100) - s.get('roll_9437_50910') < 45) {
      s.set("drop_9437_50910", 1);
      s.add("roll_9437_50910", -55);
    } else {
      s.add("roll_9437_50910", 45);
      s.set("drop_9437_50910", 0);
    }
    switch (s.pick("seed_byjzt", [50,50])) {
      case 0:
        s.set("drop_50910_equip", s.draw('seed_byjzt', 4));
        break;
      case 1:
        s.set("drop_50910_equip", 0);
        break;
    }
    switch (s.pick("seed_byjzt", [50,5,15,30])) {
      case 0:
        s.set("drop_50910_color", 1);
        break;
      case 1:
        s.set("drop_50910_color", 4);
        break;
      case 2:
        s.set("drop_50910_color", 3);
        break;
      case 3:
        s.set("drop_50910_color", 2);
        break;
    }
    if (s.get('win_byjzt') >= 14 && s.draw('seed_byjzt', 1000) - s.get('win_byjzt') <= 50  && s.get('drop_9430_44122') === 0) {
      s.set("drop_9430_44122", 1);
    } else {
      s.set("drop_9430_44122", 0);
    }
    if (s.draw('seed_byjzt', 100) - s.get('roll_9438_44122') < 45) {
      s.set("drop_9438_44122", 1);
      s.add("roll_9438_44122", -55);
    } else {
      s.add("roll_9438_44122", 45);
      s.set("drop_9438_44122", 0);
    }
    switch (s.pick("seed_byjzt", [50,50])) {
      case 0:
        s.set("drop_44122_equip", s.draw('seed_byjzt', 4));
        break;
      case 1:
        s.set("drop_44122_equip", 0);
        break;
    }
    switch (s.pick("seed_byjzt", [50,5,15,30])) {
      case 0:
        s.set("drop_44122_color", 1);
        break;
      case 1:
        s.set("drop_44122_color", 4);
        break;
      case 2:
        s.set("drop_44122_color", 3);
        break;
      case 3:
        s.set("drop_44122_color", 2);
        break;
    }
  }

  function route9(s) {
    if (s.draw('seed_byjzt', 1000) - s.get('win_byjzt') - s.get('win_byjztex') <= 100 && s.get('drop_5427_50941') === 0) {
      s.set("drop_5427_50941", 1);
    } else {
      s.set("drop_5427_50941", 0);
    }
    switch (s.pick("seed_byjzt", [50,50])) {
      case 0:
        s.set("drop_50941_equip", s.draw('seed_byjzt', 4));
        break;
      case 1:
        s.set("drop_50941_equip", 0);
        break;
    }
    switch (s.pick("seed_byjzt", [50,5,15,30])) {
      case 0:
        s.set("drop_50941_color", 1);
        break;
      case 1:
        s.set("drop_50941_color", 4);
        break;
      case 2:
        s.set("drop_50941_color", 3);
        break;
      case 3:
        s.set("drop_50941_color", 2);
        break;
    }
    if (s.draw('seed_byjzt', 1000) - s.get('win_byjzt') - s.get('win_byjztex')<= 100 && s.get('drop_5223_50950') === 0) {
      s.set("drop_5223_50950", 1);
    } else {
      s.set("drop_5223_50950", 0);
    }
    if (s.draw('seed_byjzt', 100) - s.get('roll_9437_50950') < 45) {
      s.set("drop_9437_50950", 1);
      s.add("roll_9437_50950", -55);
    } else {
      s.add("roll_9437_50950", 45);
      s.set("drop_9437_50950", 0);
    }
    switch (s.pick("seed_byjzt", [50,50])) {
      case 0:
        s.set("drop_50950_equip", s.draw('seed_byjzt', 4));
        break;
      case 1:
        s.set("drop_50950_equip", 0);
        break;
    }
    switch (s.pick("seed_byjzt", [50,5,15,30])) {
      case 0:
        s.set("drop_50950_color", 1);
        break;
      case 1:
        s.set("drop_50950_color", 4);
        break;
      case 2:
        s.set("drop_50950_color", 3);
        break;
      case 3:
        s.set("drop_50950_color", 2);
        break;
    }
    if (s.draw('seed_byjzt', 1000) - s.get('win_byjzt') - s.get('win_byjztex')<= 50  && s.get('drop_9430_44138') === 0) {
      s.set("drop_9430_44138", 1);
    } else {
      s.set("drop_9430_44138", 0);
    }
    if (s.draw('seed_byjzt', 100) - s.get('roll_9438_44138') < 45) {
      s.set("drop_9438_44138", 1);
      s.add("roll_9438_44138", -55);
    } else {
      s.add("roll_9438_44138", 45);
      s.set("drop_9438_44138", 0);
    }
    switch (s.pick("seed_byjzt", [50,50])) {
      case 0:
        s.set("drop_44138_equip", s.draw('seed_byjzt', 4));
        break;
      case 1:
        s.set("drop_44138_equip", 0);
        break;
    }
    switch (s.pick("seed_byjzt", [50,5,15,30])) {
      case 0:
        s.set("drop_44138_color", 1);
        break;
      case 1:
        s.set("drop_44138_color", 4);
        break;
      case 2:
        s.set("drop_44138_color", 3);
        break;
      case 3:
        s.set("drop_44138_color", 2);
        break;
    }
  }

  function route10(s) {
    if (s.get('win_ywf') >= 7 && s.draw('seed_33653', 1000) - s.get('win_ywf') <= 50  && s.get('drop_2364_33653') === 0) {
      s.set("drop_2364_33653", 1);
    } else {
      s.set("drop_2364_33653", 0);
    }
    if (s.get('win_ywf') >= 4 && s.draw('seed_33653', 1000) - s.get('win_ywf')*2 <= 50  && s.get('drop_4422_33653') === 0) {
      s.set("drop_4422_33653", 1);
    } else {
      s.set("drop_4422_33653", 0);
    }
    if (s.draw('seed_33653', 1000) - s.get('roll_2921_33653') < 400) {
      s.set("drop_2921_33653", 1);
      s.add("roll_2921_33653", -600);
    } else {
      s.add("roll_2921_33653", 400);
      s.set("drop_2921_33653", 0);
    }
    switch (s.pick("seed_33653", [50,50])) {
      case 0:
        s.set("drop_33653_equip", s.draw('seed_33653', 5));
        switch (s.pick("seed_33653", [50,5,15,30])) {
          case 0:
            s.set("drop_33653_color", 1);
            break;
          case 1:
            s.set("drop_33653_color", 4);
            break;
          case 2:
            s.set("drop_33653_color", 3);
            break;
          case 3:
            s.set("drop_33653_color", 2);
            break;
        }
        break;
      case 1:
        s.set("drop_33653_equip", 0);
        break;
    }
  }

  function route11(s) {
    if (s.get('win_ywf') >= 16 && s.draw('seed_33650', 1000) - s.get('win_ywf') <= 50  && s.get('drop_2364_33650') === 0) {
      s.set("drop_2364_33650", 1);
    } else {
      s.set("drop_2364_33650", 0);
    }
    if (s.get('win_ywf') >= 20 && s.draw('seed_33650', 1000) - s.get('win_ywf') <= 10  && s.get('drop_7081_33650') === 0) {
      s.set("drop_7081_33650", 1);
    } else {
      s.set("drop_7081_33650", 0);
    }
    if (s.draw('seed_33650', 100) - s.get('roll_2920_33650') < 50) {
      s.set("drop_2920_33650", 1);
      s.add("roll_2920_33650", -50);
    } else {
      s.add("roll_2920_33650", 50);
      s.set("drop_2920_33650", 0);
    }
    if (s.get('win_ywf') >= 12 && s.draw('seed_33650', 1000) - s.get('win_ywf')*2 <= 40  && s.get('drop_5422_33650') === 0) {
      s.set("drop_5422_33650", 1);
    } else {
      s.set("drop_5422_33650", 0);
    }
    switch (s.pick("seed_33650", [50,50])) {
      case 0:
        s.set("drop_33650_equip", s.draw('seed_33650', 9));
        switch (s.pick("seed_33650", [5,44,16,45])) {
          case 0:
            s.set("drop_33650_color", 4);
            break;
          case 1:
            s.set("drop_33650_color", 1);
            break;
          case 2:
            s.set("drop_33650_color", 3);
            break;
          case 3:
            s.set("drop_33650_color", 2);
            break;
        }
        break;
      case 1:
        s.set("drop_33650_equip", 0);
        break;
    }
  }

  function route12(s) {
    if (s.draw('seed_dcy_40372', 1000) - s.get('win_dcy')*2 <= 50  && s.get('drop_4634_40372') === 0) {
      s.set("drop_4634_40372", 1);
    } else {
      s.set("drop_4634_40372", 0);
    }
    if (s.draw('seed_dcy_40372', 1000) - s.get('win_dcy') <= 40  && s.get('drop_9072_40372') === 0) {
      s.set("drop_9072_40372", 1);
    } else {
      s.set("drop_9072_40372", 0);
    }
    if (s.draw('seed_dcy_40372', 1000) - s.get('win_dcy') <= 200  && s.get('drop_3523_40372') === 0) {
      s.set("drop_3523_40372", 1);
    } else {
      s.set("drop_3523_40372", 0);
    }
    if (s.draw('seed_dcy_40372', 1000) - s.get('roll_2924_40372') < 400) {
      s.set("drop_2924_40372", 1);
      s.add("roll_2924_40372", -600);
    } else {
      s.add("roll_2924_40372", 400);
      s.set("drop_2924_40372", 0);
    }
    switch (s.pick("seed_dcy_40372", [200,40372,40372,40372,40372,40372,40372,40372])) {
      case 0:
        s.set("name_drop_40372", 0);
        break;
      case 1:
        s.add("num_2606_40372", 1);
        s.set("name_drop_40372", 2606);
        break;
      case 2:
        s.add("num_2603_40372", 1);
        s.set("name_drop_40372", 2603);
        break;
      case 3:
        s.add("num_2641_40372", 1);
        s.set("name_drop_40372", 2641);
        break;
      case 4:
        s.add("num_2605_40372", 1);
        s.set("name_drop_40372", 2605);
        break;
      case 5:
        s.add("num_2601_40372", 1);
        s.set("name_drop_40372", 2601);
        break;
      case 6:
        s.add("num_2607_40372", 1);
        s.set("name_drop_40372", 2607);
        break;
      case 7:
        s.add("num_2604_40372", 1);
        s.set("name_drop_40372", 2604);
        break;
    }
    switch (s.pick("seed_dcy_40372", [50,50])) {
      case 0:
        s.set("drop_40372_equip", s.draw('seed_dcy_40372', 5));
        switch (s.pick("seed_dcy_40372", [50,5,15,30])) {
          case 0:
            s.set("drop_40372_color", 1);
            break;
          case 1:
            s.set("drop_40372_color", 4);
            break;
          case 2:
            s.set("drop_40372_color", 3);
            break;
          case 3:
            s.set("drop_40372_color", 2);
            break;
        }
        break;
      case 1:
        s.set("drop_40372_equip", 0);
        break;
    }
  }

  function route13(s) {
    if (s.get('unlock_fgnn') === 0) {
      s.set("surprise_wsdex", 1);
      switch (s.pick("seed_wsd", [10,10,10,10,10])) {
        case 0:
          s.set("wsdcatrat_x", 17);
          s.set("wsdcatrat_y", 20);
          break;
        case 1:
          s.set("wsdcatrat_x", 16);
          s.set("wsdcatrat_y", 23);
          break;
        case 2:
          s.set("wsdcatrat_x", 19);
          s.set("wsdcatrat_y", 21);
          break;
        case 3:
          s.set("wsdcatrat_x", 18);
          s.set("wsdcatrat_y", 22);
          break;
        case 4:
          s.set("wsdcatrat_x", 19);
          s.set("wsdcatrat_y", 23);
          break;
      }
    }
    if (s.draw('seed_wsd', 100) - s.get('roll_2931_35603') < 30) {
      s.set("drop_2931_35603", 1);
      s.add("roll_2931_35603", -70);
    } else {
      s.add("roll_2931_35603", 30);
      s.set("drop_2931_35603", 0);
    }
    if (s.draw('seed_wsd', 100) - s.get('roll_8920_35603') < 45) {
      s.set("drop_8920_35603", 1);
      s.add("roll_8920_35603", -55);
    } else {
      s.add("roll_8920_35603", 45);
      s.set("drop_8920_35603", 0);
    }
    switch (s.pick("seed_wsd", [50,50])) {
      case 0:
        s.set("drop_35603_equip", s.draw('seed_wsd', 4));
        break;
      case 1:
        s.set("drop_35603_equip", 0);
        break;
    }
    switch (s.pick("seed_wsd", [30,5,25,40])) {
      case 0:
        s.set("drop_35603_color", 2);
        break;
      case 1:
        s.set("drop_35603_color", 4);
        break;
      case 2:
        s.set("drop_35603_color", 3);
        break;
      case 3:
        s.set("drop_35603_color", 1);
        break;
    }
    if (s.get('get_8926') < 6) {
      s.set("drop_8926_35603", 1);
    } else {
      if (s.get('get_8926') >= 6 && s.get('get_8926') < 15) {
        switch (s.pick("seed_wsd", [250,750])) {
          case 0:
            s.set("drop_8926_35603", 1);
            break;
          case 1:
            s.set("drop_8926_35603", 0);
            break;
        }
      } else {
        switch (s.pick("seed_wsd", [950,50])) {
          case 0:
            s.set("drop_8926_35603", 0);
            break;
          case 1:
            s.set("drop_8926_35603", 1);
            break;
        }
      }
    }
    switch (s.pick("seed_wsd", [950,50])) {
      case 0:
        s.set("drop_8925_35603", 0);
        break;
      case 1:
        s.set("drop_8925_35603", 1);
        break;
    }
    if (s.draw('seed_wsd', 100) - s.get('roll_8919_50611') < 30) {
      s.set("drop_8919_50611", 1);
      s.add("roll_8919_50611", -70);
    } else {
      s.add("roll_8919_50611", 30);
      s.set("drop_8919_50611", 0);
    }
    if (s.draw('seed_wsd', 600) - s.get('win_wsd') - s.get('win_wsdex') <= 100  && s.get('drop_5631_50611') === 0) {
      s.set("drop_5631_50611", 1);
    } else {
      s.set("drop_5631_50611", 0);
    }
    switch (s.pick("seed_wsd", [50,50])) {
      case 0:
        s.set("drop_50611_equip", s.draw('seed_wsd', 4));
        break;
      case 1:
        s.set("drop_50611_equip", 0);
        break;
    }
    switch (s.pick("seed_wsd", [20,45,5,30])) {
      case 0:
        s.set("drop_50611_color", 1);
        break;
      case 1:
        s.set("drop_50611_color", 2);
        break;
      case 2:
        s.set("drop_50611_color", 4);
        break;
      case 3:
        s.set("drop_50611_color", 3);
        break;
    }
    if (s.get('get_8926') < 6) {
      s.set("drop_8926_50611", 1);
    } else {
      if (s.get('get_8926') >= 6 && s.get('get_8926') < 15) {
        switch (s.pick("seed_wsd", [250,750])) {
          case 0:
            s.set("drop_8926_50611", 1);
            break;
          case 1:
            s.set("drop_8926_50611", 0);
            break;
        }
      } else {
        switch (s.pick("seed_wsd", [950,50])) {
          case 0:
            s.set("drop_8926_50611", 0);
            break;
          case 1:
            s.set("drop_8926_50611", 1);
            break;
        }
      }
    }
    switch (s.pick("seed_wsd", [70,930])) {
      case 0:
        s.set("drop_8925_50611", 1);
        break;
      case 1:
        s.set("drop_8925_50611", 0);
        break;
    }
    if (s.draw('seed_wsd', 100) - s.get('win_wsd') - s.get('win_wsdex') < 40) {
      s.set("drop_med_35413", 1);
      switch (s.pick("seed_wsd", [1,1,1,1,1,1,1,1,1,1,1])) {
        case 0:
          s.add("num_zgck1_2604", 1);
          s.set("zgck1_drop_a", 2604);
          s.set("zgck1_drop_count", 1);
          s.set("limit_zgck1", 2604);
          break;
        case 1:
          s.add("num_zgck1_2605", 1);
          s.set("zgck1_drop_a", 2605);
          s.set("zgck1_drop_count", 1);
          s.set("limit_zgck1", 2605);
          break;
        case 2:
          s.add("num_zgck1_2606", 1);
          s.set("zgck1_drop_a", 2606);
          s.set("zgck1_drop_count", 1);
          s.set("limit_zgck1", 2606);
          break;
        case 3:
          s.add("num_zgck1_2617", 1);
          s.set("zgck1_drop_a", 2617);
          s.set("zgck1_drop_count", 1);
          s.set("limit_zgck1", 2617);
          break;
        case 4:
          s.add("num_zgck1_2620", 1);
          s.set("zgck1_drop_a", 2620);
          s.set("zgck1_drop_count", 1);
          s.set("limit_zgck1", 2620);
          break;
        case 5:
          s.add("num_zgck1_2618", 1);
          s.set("zgck1_drop_a", 2618);
          s.set("zgck1_drop_count", 1);
          s.set("limit_zgck1", 2618);
          break;
        case 6:
          s.add("num_zgck1_2627", 1);
          s.set("zgck1_drop_a", 2627);
          s.set("zgck1_drop_count", 1);
          s.set("limit_zgck1", 2627);
          break;
        case 7:
          s.add("num_zgck1_2619", 1);
          s.set("zgck1_drop_a", 2619);
          s.set("zgck1_drop_count", 1);
          s.set("limit_zgck1", 2619);
          break;
        case 8:
          s.add("num_zgck1_2601", 2);
          s.set("zgck1_drop_a", 2601);
          s.set("zgck1_drop_count", 2);
          s.set("limit_zgck1", 2601);
          break;
        case 9:
          s.add("num_zgck1_2602", 3);
          s.set("zgck1_drop_a", 2602);
          s.set("zgck1_drop_count", 3);
          s.set("limit_zgck1", 2602);
          break;
        case 10:
          s.add("num_zgck1_2603", 1);
          s.set("zgck1_drop_a", 2603);
          s.set("zgck1_drop_count", 1);
          s.set("limit_zgck1", 2603);
          break;
      }
    } else {
      s.set("drop_med_35413", 0);
    }
    if (s.draw('seed_wsd', 100) - s.get('roll_8922_35413') < 45) {
      s.set("drop_8922_35413", 1);
      s.add("roll_8922_35413", -55);
    } else {
      s.add("roll_8922_35413", 45);
      s.set("drop_8922_35413", 0);
    }
    if (s.draw('seed_wsd', 1000)  < 50 && s.get('get_8816')<50) {
      s.set("drop_8816_35413", 1);
    } else {
      s.set("drop_8816_35413", 0);
    }
    switch (s.pick("seed_wsd", [50,50])) {
      case 0:
        s.set("drop_35413_equip", s.draw('seed_wsd', 4));
        break;
      case 1:
        s.set("drop_35413_equip", 0);
        break;
    }
    switch (s.pick("seed_wsd", [35,20,5,40])) {
      case 0:
        s.set("drop_35413_color", 3);
        break;
      case 1:
        s.set("drop_35413_color", 1);
        break;
      case 2:
        s.set("drop_35413_color", 4);
        break;
      case 3:
        s.set("drop_35413_color", 2);
        break;
    }
    switch (s.pick("seed_wsd", [950,50])) {
      case 0:
        s.set("drop_8926_35413", 0);
        break;
      case 1:
        s.set("drop_8926_35413", 1);
        break;
    }
    switch (s.pick("seed_wsd", [900,100])) {
      case 0:
        s.set("drop_8925_35413", 0);
        break;
      case 1:
        s.set("drop_8925_35413", 1);
        break;
    }
    if (s.draw('seed_wsd', 700) - s.get('win_wsd') - s.get('win_wsdex') <= 100  && s.get('drop_4823_35420') === 0) {
      s.set("drop_4823_35420", 1);
    } else {
      s.set("drop_4823_35420", 0);
    }
    if (s.draw('seed_wsd', 700) - s.get('win_wsd') - s.get('win_wsdex') <= 100  && s.get('drop_5426_35420') === 0) {
      s.set("drop_5426_35420", 1);
    } else {
      s.set("drop_5426_35420", 0);
    }
    if (s.draw('seed_wsd', 100) - s.get('roll_8921_35420')  < 35) {
      s.set("drop_8921_35420", 1);
      s.add("roll_8921_35420", -65);
    } else {
      s.add("roll_8921_35420", 35);
      s.set("drop_8921_35420", 0);
    }
    if (s.draw('seed_wsd', 1000) < 50 && s.get('get_8816')<50) {
      s.set("drop_8816_35420", 1);
    } else {
      s.set("drop_8816_35420", 0);
    }
    switch (s.pick("seed_wsd", [50,50])) {
      case 0:
        s.set("drop_35420_equip", s.draw('seed_wsd', 4));
        break;
      case 1:
        s.set("drop_35420_equip", 0);
        break;
    }
    switch (s.pick("seed_wsd", [40,5,40,15])) {
      case 0:
        s.set("drop_35420_color", 3);
        break;
      case 1:
        s.set("drop_35420_color", 4);
        break;
      case 2:
        s.set("drop_35420_color", 2);
        break;
      case 3:
        s.set("drop_35420_color", 1);
        break;
    }
    switch (s.pick("seed_wsd", [950,50])) {
      case 0:
        s.set("drop_8926_35420", 0);
        break;
      case 1:
        s.set("drop_8926_35420", 1);
        break;
    }
    switch (s.pick("seed_wsd", [850,150])) {
      case 0:
        s.set("drop_8925_35420", 0);
        break;
      case 1:
        s.set("drop_8925_35420", 1);
        break;
    }
  }

  function route14(s) {
    if (s.draw('seed_zjb', 1000) - s.get('win_zjb') <= 150  && s.get('drop_4621_33886') === 0) {
      s.set("drop_4621_33886", 1);
    } else {
      s.set("drop_4621_33886", 0);
    }
    switch (s.pick("seed_zjb", [40,10,50])) {
      case 0:
        s.set("drop_33886_equip", s.draw('seed_zjb', 5));
        s.set("drop_33886_weapon", 0);
        break;
      case 1:
        s.set("drop_33886_weapon", s.draw('seed_zjb', 4));
        s.set("drop_33886_equip", 0);
        break;
      case 2:
        s.set("drop_33886_weapon", 0);
        s.set("drop_33886_equip", 0);
        break;
    }
    switch (s.pick("seed_zjb", [30,60,1,9])) {
      case 0:
        s.set("drop_33886_color", 2);
        break;
      case 1:
        s.set("drop_33886_color", 1);
        break;
      case 2:
        s.set("drop_33886_color", 4);
        break;
      case 3:
        s.set("drop_33886_color", 3);
        break;
    }
    if (s.draw('seed_zjb', 1000) - s.get('win_zjb') <= 150  && s.get('drop_4416_33887') === 0) {
      s.set("drop_4416_33887", 1);
    } else {
      s.set("drop_4416_33887", 0);
    }
    switch (s.pick("seed_zjb", [40,10,50])) {
      case 0:
        s.set("drop_33887_equip", s.draw('seed_zjb', 5));
        s.set("drop_33887_weapon", 0);
        break;
      case 1:
        s.set("drop_33887_weapon", s.draw('seed_zjb', 4));
        s.set("drop_33887_equip", 0);
        break;
      case 2:
        s.set("drop_33887_weapon", 0);
        s.set("drop_33887_equip", 0);
        break;
    }
    switch (s.pick("seed_zjb", [30,60,1,9])) {
      case 0:
        s.set("drop_33887_color", 2);
        break;
      case 1:
        s.set("drop_33887_color", 1);
        break;
      case 2:
        s.set("drop_33887_color", 4);
        break;
      case 3:
        s.set("drop_33887_color", 3);
        break;
    }
    switch (s.pick("seed_zjb", [40,10,50])) {
      case 0:
        s.set("drop_33888_equip", s.draw('seed_zjb', 5));
        s.set("drop_33888_weapon", 0);
        break;
      case 1:
        s.set("drop_33888_weapon", s.draw('seed_zjb', 4));
        s.set("drop_33888_equip", 0);
        break;
      case 2:
        s.set("drop_33888_weapon", 0);
        s.set("drop_33888_equip", 0);
        break;
    }
    switch (s.pick("seed_zjb", [30,60,1,9])) {
      case 0:
        s.set("drop_33888_color", 2);
        break;
      case 1:
        s.set("drop_33888_color", 1);
        break;
      case 2:
        s.set("drop_33888_color", 4);
        break;
      case 3:
        s.set("drop_33888_color", 3);
        break;
    }
    if (s.draw('seed_zjb', 1000) - s.get('roll_1049_33888') < 50) {
      s.set("drop_1049_33888", 1);
      s.add("roll_1049_33888", -950);
    } else {
      s.add("roll_1049_33888", 50);
      s.set("drop_1049_33888", 0);
    }
    if (s.draw('seed_zjb', 1000) - s.get('win_zjb') <= 30  && s.get('drop_7231_33888') === 0) {
      s.set("drop_7231_33888", 1);
    } else {
      s.set("drop_7231_33888", 0);
    }
  }

  function route15(s) {
    if (s.draw('seed_kgm', 1000) - s.get('win_kgm')*3 <= 90  && s.get('drop_5418_35111') === 0) {
      s.set("drop_5418_35111", 1);
    } else {
      s.set("drop_5418_35111", 0);
    }
    switch (s.pick("seed_kgm", [50,50])) {
      case 0:
        s.set("drop_35111_equip", s.draw('seed_kgm', 4));
        break;
      case 1:
        s.set("drop_35111_equip", 0);
        break;
    }
    switch (s.pick("seed_kgm", [50,5,15,30])) {
      case 0:
        s.set("drop_35111_color", 1);
        break;
      case 1:
        s.set("drop_35111_color", 4);
        break;
      case 2:
        s.set("drop_35111_color", 3);
        break;
      case 3:
        s.set("drop_35111_color", 2);
        break;
    }
    if (s.draw('seed_kgm', 100) - s.get('roll_2916_35112') < 45) {
      s.set("drop_2916_35112", 1);
      s.add("roll_2916_35112", -55);
    } else {
      s.add("roll_2916_35112", 45);
      s.set("drop_2916_35112", 0);
    }
    if (s.draw('seed_kgm', 1000) - s.get('win_kgm')*3 <= 50  && s.get('drop_5615_35112') === 0) {
      s.set("drop_5615_35112", 1);
    } else {
      s.set("drop_5615_35112", 0);
    }
    switch (s.pick("seed_kgm", [50,50])) {
      case 0:
        s.set("drop_35112_equip", s.draw('seed_kgm', 4));
        break;
      case 1:
        s.set("drop_35112_equip", 0);
        break;
    }
    switch (s.pick("seed_kgm", [50,5,15,30])) {
      case 0:
        s.set("drop_35112_color", 1);
        break;
      case 1:
        s.set("drop_35112_color", 4);
        break;
      case 2:
        s.set("drop_35112_color", 3);
        break;
      case 3:
        s.set("drop_35112_color", 2);
        break;
    }
    if (s.draw('seed_kgm', 100) - s.get('roll_2917_35114') < 45) {
      s.set("drop_2917_35114", 1);
      s.add("roll_2917_35114", -55);
    } else {
      s.add("roll_2917_35114", 45);
      s.set("drop_2917_35114", 0);
    }
    if (s.draw('seed_kgm', 1000) - s.get('win_kgm')*3 <= 50  && s.get('drop_4018_35114') === 0) {
      s.set("drop_4018_35114", 1);
    } else {
      s.set("drop_4018_35114", 0);
    }
    switch (s.pick("seed_kgm", [50,50])) {
      case 0:
        s.set("drop_35114_equip", s.draw('seed_kgm', 8));
        break;
      case 1:
        s.set("drop_35114_equip", 0);
        break;
    }
    switch (s.pick("seed_kgm", [50,5,15,30])) {
      case 0:
        s.set("drop_35114_color", 1);
        break;
      case 1:
        s.set("drop_35114_color", 4);
        break;
      case 2:
        s.set("drop_35114_color", 3);
        break;
      case 3:
        s.set("drop_35114_color", 2);
        break;
    }
  }
  window.SBJDungeonOrange = {
    "drop_4820_40373": {seed:"seed_dcy_40373",counter:"win_dcy",active:"fuben_dcy",run:route1},
    "drop_5618_33652": {seed:"seed_33652",counter:"win_ywf",active:"fuben_ywf",run:route2},
    "drop_4418_40172": {seed:"seed_trm",counter:"win_trm",active:"fuben_trm",run:route3},
    "drop_4419_40171": {seed:"seed_trm",counter:"win_trm",active:"fuben_trm",run:route3},
    "drop_4217_33858": {seed:"seed_tyj",counter:"win_tyj",active:"fuben_tyj",run:route4},
    "drop_4619_33860": {seed:"seed_tyj",counter:"win_tyj",active:"fuben_tyj",run:route4},
    "drop_4817_33860": {seed:"seed_tyj",counter:"win_tyj",active:"fuben_tyj",run:route4},
    "drop_5211_33861": {seed:"seed_tyj",counter:"win_tyj",active:"fuben_tyj",run:route4},
    "drop_7264_35219": {seed:"seed_byj",counter:"win_byj",active:"fuben_byj",run:route5},
    "drop_7265_35219": {seed:"seed_byj",counter:"win_byj",active:"fuben_byj",run:route5},
    "drop_5218_40374": {seed:"seed_dcy_40374",counter:"win_dcy",active:"fuben_dcy",run:route6},
    "drop_5628_35264": {seed:"seed_lsby",counter:"win_lsby",active:"fuben_lsby",run:route7},
    "drop_5427_50883": {seed:"seed_byjzt",counter:"win_byjzt",active:"fuben_byjzt",run:route8},
    "drop_5427_50941": {seed:"seed_byjzt",counter:"win_byjztex",active:"fuben_byjzt",run:route9},
    "drop_7267_35221": {seed:"seed_byj",counter:"win_byj",active:"fuben_byj",run:route5},
    "drop_7266_35221": {seed:"seed_byj",counter:"win_byj",active:"fuben_byj",run:route5},
    "drop_4422_33653": {seed:"seed_33653",counter:"win_ywf",active:"fuben_ywf",run:route10},
    "drop_5422_33650": {seed:"seed_33650",counter:"win_ywf",active:"fuben_ywf",run:route11},
    "drop_5020_35260": {seed:"seed_lsby",counter:"win_lsby",active:"fuben_lsby",run:route7},
    "drop_4634_40372": {seed:"seed_dcy_40372",counter:"win_dcy",active:"fuben_dcy",run:route12},
    "drop_4823_35420": {seed:"seed_wsd",counter:"win_wsdex",active:"fuben_wsd",run:route13},
    "drop_5426_35420": {seed:"seed_wsd",counter:"win_wsdex",active:"fuben_wsd",run:route13},
    "drop_5631_50611": {seed:"seed_wsd",counter:"win_wsdex",active:"fuben_wsd",run:route13},
    "drop_5223_50910": {seed:"seed_byjzt",counter:"win_byjzt",active:"fuben_byjzt",run:route8},
    "drop_5223_50950": {seed:"seed_byjzt",counter:"win_byjztex",active:"fuben_byjzt",run:route9},
    "drop_4621_33886": {seed:"seed_zjb",counter:"win_zjb",active:"",run:route14},
    "drop_4416_33887": {seed:"seed_zjb",counter:"win_zjb",active:"",run:route14},
    "drop_5418_35111": {seed:"seed_kgm",counter:"win_kgm",active:"fuben_kgm",run:route15},
    "drop_5615_35112": {seed:"seed_kgm",counter:"win_kgm",active:"fuben_kgm",run:route15},
    "drop_4018_35114": {seed:"seed_kgm",counter:"win_kgm",active:"fuben_kgm",run:route15}
  };
})();
